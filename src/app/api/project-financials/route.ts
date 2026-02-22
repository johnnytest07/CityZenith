import { NextRequest, NextResponse } from 'next/server'
import type { ProjectBuilding, ProjectType, ProjectFinancials } from '@/types/project'
import type { SiteContext } from '@/types/siteContext'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-pro'

const LOCATION_BENCHMARKS = `UK GDV BENCHMARKS (£/m² NIA):
  Zone 2–3 London: £6,000–£9,000 | Zone 3–4: £4,500–£6,500 | Outer London/SE: £2,500–£4,500
  Other UK cities: £1,800–£3,500 | Rural/suburban: £1,200–£2,200`

function buildingInfo(b: ProjectBuilding): string {
  const gia = b.footprintM2 != null && b.impliedStoreys != null
    ? Math.round(b.footprintM2 * b.impliedStoreys * 0.85)
    : null
  return `BUILDING:
  Location: ${b.lngLat[1].toFixed(5)}°N, ${b.lngLat[0].toFixed(5)}°E
  Type: ${b.buildingType ?? 'unknown'} | Use: ${b.buildingUse ?? 'unknown'}
  Height: ${b.heightM != null ? `${b.heightM}m` : 'unknown'} | Storeys: ${b.impliedStoreys ?? 'unknown'}
  Footprint: ${b.footprintM2 != null ? `${Math.round(b.footprintM2)}m²` : 'unknown'}
  Estimated GIA: ${gia != null ? `${gia}m²` : 'unknown'}`
}

function planningContext(sc?: SiteContext): string {
  if (!sc) return ''
  const stats = sc.planningContextStats
  const approvalRate = stats?.approval_rate != null
    ? `${(stats.approval_rate * 100).toFixed(0)}%`
    : 'unknown'
  const buildings = sc.nearbyContextFeatures.buildings.features
  const heights = buildings
    .map((f) => {
      const h = f.properties?.render_height ?? f.properties?.height
      return typeof h === 'number' ? h : typeof h === 'string' ? parseFloat(h) : NaN
    })
    .filter((h) => !isNaN(h) && h > 0)
    .sort((a, b) => a - b)
  const medianH = heights.length > 0 ? heights[Math.floor(heights.length / 2)].toFixed(1) : 'unknown'
  return `
PLANNING CONTEXT:
  Nearby approval rate: ${approvalRate}
  Median nearby building height: ${medianH}m
  Nearby building count: ${buildings.length}`
}

const COMMON_FACTORS = `factors: 4–5 items, each value must contain £ or %`

const COMMON_TAIL = `summary: 2–3 sentences with actual £ and % figures
confidence: "high" if footprint/height known; "medium" if partial data; "low" if most data unknown
${COMMON_FACTORS}`

function buildPrompt(type: ProjectType, building: ProjectBuilding, sc?: SiteContext): string {
  const bi = buildingInfo(building)
  const pc = planningContext(sc)

  switch (type) {
    case 'renovation':
      return `You are a UK property development consultant estimating renovation returns.

${bi}${pc}

UK RENOVATION COST BENCHMARKS (£/m² GIA):
  Light refurb: £300–£500 | Medium: £600–£900 | Full gut-strip: £950–£1,400
${LOCATION_BENCHMARKS}
ACQUISITION PROXY: assume 65% of post-renovation GDV.
netProfitEstimate = GDV - (GDV × 0.65) - mid reno cost
roiPercent = (netProfit / (acquisition + mid cost)) × 100, clamp to −100..500

Return ONLY valid JSON:
{
  "gdvEstimate": <int>,
  "renovationCostRange": [<int low>, <int high>],
  "totalInvestment": <int — acquisition + mid reno cost>,
  "netProfitEstimate": <int>,
  "roiPercent": <float 1dp>,
  "primaryMetric": "ROI",
  "primaryValue": "<roiPercent>%",
  "summary": "<string>",
  "confidence": "high"|"medium"|"low",
  "factors": [{ "label": "<≤20 chars>", "value": "<with £ or %>", "impact": "positive"|"neutral"|"negative" }]
}`

    case 'new-build':
      return `You are a UK property development consultant estimating new-build development returns.

${bi}${pc}

UK NEW BUILD COST BENCHMARKS (£/m² GIA):
  Standard residential: £1,800–£2,500 | High spec: £2,500–£3,500 | Commercial: £1,500–£2,800
${LOCATION_BENCHMARKS}
SITE ACQUISITION PROXY: assume 25–35% of completed GDV (residual land value approach).
developmentMarginPercent = (GDV - totalInvestment) / GDV × 100 — industry target is 15–20%

Return ONLY valid JSON:
{
  "gdvEstimate": <int>,
  "buildCostRange": [<int low>, <int high>],
  "totalInvestment": <int — site acquisition + mid build cost + 10% contingency>,
  "netProfitEstimate": <int>,
  "developmentMarginPercent": <float 1dp>,
  "primaryMetric": "Dev Margin",
  "primaryValue": "<developmentMarginPercent>%",
  "summary": "<string>",
  "confidence": "high"|"medium"|"low",
  "factors": [{ "label": "<≤20 chars>", "value": "<with £ or %>", "impact": "positive"|"neutral"|"negative" }]
}`

    case 'demolish-rebuild':
      return `You are a UK property development consultant estimating demolish-and-rebuild returns.

${bi}${pc}

UK DEMOLITION COSTS:
  Typical house: £8,000–£40,000 | Larger structure: £500–£800/m² GIA
UK NEW BUILD COSTS (£/m² GIA):
  Standard residential: £1,800–£2,500 | High spec: £2,500–£3,500
${LOCATION_BENCHMARKS}
ACQUISITION PROXY: assume 50% of post-reno GDV (building has some value but is being cleared).
totalInvestment = acquisition + demolition + mid build cost + 10% contingency
roiPercent = (netProfit / totalInvestment) × 100, clamp to −100..500

Return ONLY valid JSON:
{
  "gdvEstimate": <int>,
  "demolitionCost": <int>,
  "buildCostRange": [<int low>, <int high>],
  "totalInvestment": <int>,
  "netProfitEstimate": <int>,
  "roiPercent": <float 1dp>,
  "primaryMetric": "ROI",
  "primaryValue": "<roiPercent>%",
  "summary": "<string>",
  "confidence": "high"|"medium"|"low",
  "factors": [{ "label": "<≤20 chars>", "value": "<with £ or %>", "impact": "positive"|"neutral"|"negative" }]
}`

    case 'extension':
      return `You are a UK property development consultant estimating extension returns.

${bi}${pc}

UK EXTENSION COST BENCHMARKS (£/m²):
  Single storey rear: £1,500–£2,200 | Double storey: £1,800–£2,800 | Loft conversion: £1,200–£2,000
  Basement: £3,000–£5,000
EXTENSION SIZE ASSUMPTION: assume a reasonable extension of 20–35% of existing footprint.
VALUE UPLIFT: extensions typically add 10–15% to property value per 10% GIA increase.
Estimate the current building value from location/type, then compute the value added.
totalInvestment = mid extension cost (no acquisition — owner-occupier model)
upliftPercent = valueUplift / totalInvestment × 100

Return ONLY valid JSON:
{
  "extensionCostRange": [<int low>, <int high>],
  "totalInvestment": <int — mid cost>,
  "valueUplift": <int — £ added to property value>,
  "netProfitEstimate": <int — valueUplift - totalInvestment>,
  "upliftPercent": <float 1dp — return on extension cost>,
  "primaryMetric": "Value Uplift",
  "primaryValue": "£<valueUplift formatted with commas>",
  "summary": "<string>",
  "confidence": "high"|"medium"|"low",
  "factors": [{ "label": "<≤20 chars>", "value": "<with £ or %>", "impact": "positive"|"neutral"|"negative" }]
}`

    case 'change-of-use':
      return `You are a UK property development consultant estimating change-of-use returns.

${bi}${pc}

COMMON UK USE CLASS CONVERSIONS:
  Commercial → Residential: often highest uplift in residential areas
  Office → Residential (Class MA PD): may not need full planning in some cases
  Retail → Residential: uplift depends heavily on location
  Residential → HMO: often 30–60% yield improvement

CONVERSION COST BENCHMARKS (£/m² GIA):
  Light conversion: £200–£500 | Moderate structural: £500–£900 | Major reconfiguration: £900–£1,400

Suggest the optimal use conversion for this building type and location.
upliftPercent = (gdvEstimate - totalInvestment) / totalInvestment × 100, clamp to −100..400

Return ONLY valid JSON:
{
  "gdvEstimate": <int — estimated value in the proposed use class>,
  "totalInvestment": <int — mid conversion cost; no acquisition assumed — assess in-place conversion>,
  "netProfitEstimate": <int — value uplift minus conversion cost>,
  "upliftPercent": <float 1dp>,
  "suggestedUse": "<proposed use class or type, e.g. 'Residential flats (Class C3)'>",
  "primaryMetric": "Uplift",
  "primaryValue": "<upliftPercent>%",
  "summary": "<string — explain the proposed conversion and rationale>",
  "confidence": "high"|"medium"|"low",
  "factors": [{ "label": "<≤20 chars>", "value": "<with £ or %>", "impact": "positive"|"neutral"|"negative" }]
}`

    case 'subdivision':
      return `You are a UK property development consultant estimating subdivision returns.

${bi}${pc}

UK SUBDIVISION BENCHMARKS:
  Conversion cost per unit: £40,000–£80,000 (light) | £80,000–£140,000 (heavy structural)
  Suitable unit count: estimate based on GIA — typical UK flat ~55–75m² NIA
${LOCATION_BENCHMARKS}
ACQUISITION PROXY: assume current value of building = 70% of total post-subdivision GDV.
roiPercent = (netProfit / (acquisition + conversion cost)) × 100, clamp to −100..500

Return ONLY valid JSON:
{
  "unitCount": <int — estimated number of units achievable>,
  "gdvPerUnit": <int — estimated sale price per unit>,
  "gdvEstimate": <int — unitCount × gdvPerUnit>,
  "totalInvestment": <int — acquisition + mid conversion cost>,
  "netProfitEstimate": <int>,
  "roiPercent": <float 1dp>,
  "primaryMetric": "ROI",
  "primaryValue": "<roiPercent>%",
  "summary": "<string>",
  "confidence": "high"|"medium"|"low",
  "factors": [{ "label": "<≤20 chars>", "value": "<with £ or %>", "impact": "positive"|"neutral"|"negative" }]
}`
  }
}

function validateFinancials(parsed: Record<string, unknown>, type: ProjectType): string | null {
  if (typeof parsed.summary !== 'string') return 'Missing summary'
  if (!Array.isArray(parsed.factors)) return 'Missing factors'
  if (!['high', 'medium', 'low'].includes(parsed.confidence as string)) return 'Invalid confidence'
  if (typeof parsed.primaryMetric !== 'string' || typeof parsed.primaryValue !== 'string') return 'Missing primaryMetric/primaryValue'
  return null
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 503 })

  let projectType: ProjectType
  let building: ProjectBuilding
  let siteContext: SiteContext | undefined
  try {
    const body = await request.json()
    projectType = body.projectType
    building = body.building
    siteContext = body.siteContext
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!projectType || !building?.lngLat) {
    return NextResponse.json({ error: 'projectType and building are required' }, { status: 400 })
  }

  const prompt = buildPrompt(projectType, building, siteContext)

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
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) },
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json({ error: `Gemini API error (${res.status})`, details: err }, { status: res.status })
    }

    const data = await res.json()
    const parts: Array<{ text?: string; thought?: boolean }> = data?.candidates?.[0]?.content?.parts ?? []
    const text = parts.find((p) => p.text && !p.thought)?.text ?? ''

    if (!text) return NextResponse.json({ error: 'Empty response from Gemini' }, { status: 502 })

    let result: ProjectFinancials
    try {
      const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
      const parsed = JSON.parse(cleaned) as Record<string, unknown>

      const validationError = validateFinancials(parsed, projectType)
      if (validationError) throw new Error(validationError)

      // Clamp percentage fields
      const clamp = (v: unknown, lo: number, hi: number) =>
        typeof v === 'number' ? Math.min(hi, Math.max(lo, Math.round(v * 10) / 10)) : undefined

      result = {
        projectType,
        primaryMetric: parsed.primaryMetric as string,
        primaryValue: parsed.primaryValue as string,
        summary: parsed.summary as string,
        factors: (parsed.factors as ProjectFinancials['factors']) ?? [],
        confidence: parsed.confidence as ProjectFinancials['confidence'],
        totalInvestment: typeof parsed.totalInvestment === 'number' ? Math.round(parsed.totalInvestment) : null,
        netProfitEstimate: typeof parsed.netProfitEstimate === 'number' ? Math.round(parsed.netProfitEstimate) : null,
        // Optional fields — set only if present
        ...(parsed.gdvEstimate != null && { gdvEstimate: Math.round(parsed.gdvEstimate as number) }),
        ...(parsed.renovationCostRange != null && { renovationCostRange: (parsed.renovationCostRange as [number, number]).map(Math.round) as [number, number] }),
        ...(parsed.roiPercent != null && { roiPercent: clamp(parsed.roiPercent, -100, 500) }),
        ...(parsed.buildCostRange != null && { buildCostRange: (parsed.buildCostRange as [number, number]).map(Math.round) as [number, number] }),
        ...(parsed.demolitionCost != null && { demolitionCost: Math.round(parsed.demolitionCost as number) }),
        ...(parsed.developmentMarginPercent != null && { developmentMarginPercent: clamp(parsed.developmentMarginPercent, -100, 100) }),
        ...(parsed.extensionCostRange != null && { extensionCostRange: (parsed.extensionCostRange as [number, number]).map(Math.round) as [number, number] }),
        ...(parsed.valueUplift != null && { valueUplift: Math.round(parsed.valueUplift as number) }),
        ...(parsed.upliftPercent != null && { upliftPercent: clamp(parsed.upliftPercent, -100, 400) }),
        ...(parsed.suggestedUse != null && { suggestedUse: parsed.suggestedUse as string }),
        ...(parsed.unitCount != null && { unitCount: Math.round(parsed.unitCount as number) }),
        ...(parsed.gdvPerUnit != null && { gdvPerUnit: Math.round(parsed.gdvPerUnit as number) }),
      }
    } catch (e) {
      return NextResponse.json({ error: `Parse error: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 })
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: `Request failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 502 })
  }
}
