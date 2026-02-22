import { NextRequest, NextResponse } from 'next/server'
import type { RenovationBuilding, RenovationResult } from '@/types/renovation'
import type { SiteContext } from '@/types/siteContext'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-pro'

function buildPrompt(building: RenovationBuilding, siteContext?: SiteContext): string {
  const {
    heightM,
    buildingType,
    buildingUse,
    impliedStoreys,
    lngLat,
    footprintM2,
  } = building

  const gia =
    footprintM2 != null && impliedStoreys != null
      ? Math.round(footprintM2 * impliedStoreys * 0.85)
      : null

  let planningContext = ''
  if (siteContext) {
    const stats = siteContext.planningContextStats
    const approvalRate =
      stats?.approval_rate != null
        ? `${(stats.approval_rate * 100).toFixed(0)}%`
        : 'unknown'

    const buildings = siteContext.nearbyContextFeatures.buildings.features
    const heights = buildings
      .map((f) => {
        const h = f.properties?.render_height ?? f.properties?.height
        return typeof h === 'number' ? h : typeof h === 'string' ? parseFloat(h) : NaN
      })
      .filter((h) => !isNaN(h) && h > 0)
      .sort((a, b) => a - b)

    const medianHeight =
      heights.length > 0
        ? heights[Math.floor(heights.length / 2)].toFixed(1)
        : 'unknown'

    planningContext = `
PLANNING CONTEXT:
  Nearby approval rate: ${approvalRate}
  Median nearby building height: ${medianHeight}m
  Nearby building count: ${buildings.length}`
  }

  return `You are a UK property development consultant estimating renovation returns.

BUILDING:
  Location: ${lngLat[1].toFixed(5)}°N, ${lngLat[0].toFixed(5)}°E
  Type: ${buildingType ?? 'unknown'} | Use: ${buildingUse ?? 'unknown'}
  Height: ${heightM != null ? `${heightM}m` : 'unknown'} | Storeys: ${impliedStoreys ?? 'unknown'} | Footprint: ${footprintM2 != null ? `${footprintM2}m²` : 'unknown'}
  Estimated GIA: ${gia != null ? `${gia}m²` : 'unknown'}
${planningContext}

UK RENOVATION COST BENCHMARKS (£/m² GIA):
  Light refurb: £300–£500 | Medium: £600–£900 | Full gut-strip: £950–£1,400

UK GDV BENCHMARKS (£/m² NIA):
  Zone 2–3 London: £6,000–£9,000 | Zone 3–4: £4,000–£6,500
  Outer London/SE: £2,500–£4,500

ACQUISITION PROXY: assume 65% of post-renovation GDV.

Return ONLY valid JSON (no markdown, no preamble):
{
  "gdvEstimate": <integer>,
  "renovationCostRange": [<low integer>, <high integer>],
  "netProfitEstimate": <integer>,
  "roiPercent": <number to 1dp>,
  "summary": "<2–3 sentences with actual £ and % figures>",
  "confidence": "high" | "medium" | "low",
  "factors": [
    { "label": "<short label>", "value": "<value with £ or %>", "impact": "positive" | "neutral" | "negative" }
  ]
}

Notes:
- netProfitEstimate = GDV - (GDV × 0.65) - mid renovation cost
- roiPercent = (netProfit / (acquisition + mid cost)) × 100, clamped to −100..500
- factors: exactly 4–5 entries, value fields must contain £ or %
- confidence: "high" if GIA ≥ 100m² and location is clear; "low" if key data is missing`
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 503 })
  }

  let building: RenovationBuilding
  let siteContext: SiteContext | undefined
  try {
    const body = await request.json()
    building = body.building
    siteContext = body.siteContext
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!building?.lngLat || !Array.isArray(building.lngLat) || building.lngLat.length !== 2) {
    return NextResponse.json({ error: 'building with lngLat is required' }, { status: 400 })
  }

  const prompt = buildPrompt(building, siteContext)

  const geminiBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingBudget: 512 },
    },
  }

  try {
    const res = await fetch(
      `${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
      },
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: `Gemini API error (${res.status})`, details: err },
        { status: res.status },
      )
    }

    const data = await res.json()
    const parts: Array<{ text?: string; thought?: boolean }> =
      data?.candidates?.[0]?.content?.parts ?? []
    const text: string = parts.find((p) => p.text && !p.thought)?.text ?? ''

    if (!text) {
      return NextResponse.json({ error: 'Gemini returned an empty response' }, { status: 502 })
    }

    let result: RenovationResult
    try {
      const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
      const parsed = JSON.parse(cleaned)

      if (
        typeof parsed.gdvEstimate !== 'number' ||
        !Array.isArray(parsed.renovationCostRange) ||
        parsed.renovationCostRange.length !== 2 ||
        typeof parsed.netProfitEstimate !== 'number' ||
        typeof parsed.roiPercent !== 'number' ||
        typeof parsed.summary !== 'string' ||
        !Array.isArray(parsed.factors) ||
        !['high', 'medium', 'low'].includes(parsed.confidence)
      ) {
        throw new Error('Missing or invalid required fields')
      }

      // Clamp roiPercent to −100..500
      parsed.roiPercent = Math.min(500, Math.max(-100, parsed.roiPercent))

      // Normalise factors
      if (!Array.isArray(parsed.factors)) parsed.factors = []

      result = {
        gdvEstimate: Math.round(parsed.gdvEstimate),
        renovationCostRange: [
          Math.round(parsed.renovationCostRange[0]),
          Math.round(parsed.renovationCostRange[1]),
        ],
        netProfitEstimate: Math.round(parsed.netProfitEstimate),
        roiPercent: Math.round(parsed.roiPercent * 10) / 10,
        summary: parsed.summary,
        factors: parsed.factors,
        confidence: parsed.confidence,
      }
    } catch (parseErr) {
      return NextResponse.json(
        {
          error: `Failed to parse renovation result: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
        },
        { status: 502 },
      )
    }

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Gemini request failed: ${message}` }, { status: 502 })
  }
}
