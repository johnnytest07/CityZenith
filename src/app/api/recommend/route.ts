import { NextRequest, NextResponse } from 'next/server'
import type { SiteContext } from '@/types/siteContext'
import type { BuildingOption, BuildRecommendation } from '@/types/devMode'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-pro'

const BUILDING_TYPES = [
  'Detached house',
  'Semi-detached house',
  'Terraced house',
  'End-of-terrace',
  'Bungalow',
  'Maisonette',
  'Townhouse (3+ storeys)',
  'Block of flats (low-rise 3–6)',
  'Block of flats (high-rise 7+)',
  'Mixed-use retail/residential',
  'Live-work unit',
]

const STYLES = [
  'Victorian red brick',
  'Edwardian',
  '1930s red brick semi',
  'Post-war council',
  'Modern white render',
  'Contemporary red brick',
  'Brutalist/concrete',
  'Arts & Crafts',
  'Georgian',
  'Traditional slate + stone',
  'New-build standard',
]

function buildPrompt(siteContext: SiteContext, location: [number, number]): string {
  const stats = siteContext.planningContextStats
  const constraints = siteContext.statutoryConstraints

  // Constraint overrides
  const constraintNotes: string[] = []
  if (constraints['green-belt']?.intersects) {
    constraintNotes.push('GREEN BELT: No new-build flats — residential only, small scale')
  }
  if (constraints['conservation-area']?.intersects) {
    constraintNotes.push('CONSERVATION AREA: Traditional materials only — no modern white render or concrete')
  }
  if (constraints['flood-risk']?.intersects) {
    constraintNotes.push('FLOOD RISK: Ground-floor elevation required — consider raised ground floor or basement void')
  }
  if (constraints['article-4']?.intersects) {
    constraintNotes.push('ARTICLE 4: Permitted development rights restricted — full planning required for most changes')
  }

  // Nearby context
  const buildings = siteContext.nearbyContextFeatures.buildings.features
  const heights = buildings
    .map((f) => {
      const h = f.properties?.render_height ?? f.properties?.height
      return typeof h === 'number' ? h : typeof h === 'string' ? parseFloat(h) : NaN
    })
    .filter((h) => !isNaN(h) && h > 0)

  const avgHeight = heights.length > 0
    ? (heights.reduce((a, b) => a + b, 0) / heights.length).toFixed(1)
    : 'unknown'
  const maxHeight = heights.length > 0 ? Math.max(...heights).toFixed(1) : 'unknown'

  const landuseTags = Array.from(new Set(
    siteContext.nearbyContextFeatures.landuse.features
      .map((f) => f.properties?.landuse ?? f.properties?.leisure ?? f.properties?.natural)
      .filter(Boolean),
  )).slice(0, 6).join(', ')

  // Planning stats
  const approvalRate = stats?.approval_rate != null
    ? `${(stats.approval_rate * 100).toFixed(0)}%`
    : 'unknown'
  const activityLevel = stats?.council_development_activity_level ?? 'unknown'

  // Recent application types
  const appTypes = stats?.number_of_applications
    ? Object.entries(stats.number_of_applications)
        .filter(([, v]) => v > 0)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
    : 'unknown'

  return `You are a UK property development consultant. Recommend the optimal building type for a new development at coordinates [${location[1].toFixed(5)}°N, ${location[0].toFixed(5)}°E].

SITE EVIDENCE

Planning Statistics:
- Council approval rate: ${approvalRate}
- Development activity level: ${activityLevel}
- Application types on record: ${appTypes}

Statutory Constraints:
${constraintNotes.length > 0 ? constraintNotes.map((n) => `- ${n}`).join('\n') : '- No active constraints'}

Nearby Built Context (250m radius):
- Number of buildings: ${buildings.length}
- Average building height: ${avgHeight}m
- Maximum building height: ${maxHeight}m
- Adjacent land uses: ${landuseTags || 'unknown'}

AVAILABLE BUILDING TYPES:
${BUILDING_TYPES.map((t, i) => `${i + 1}. ${t}`).join('\n')}

AVAILABLE STYLES:
${STYLES.map((s, i) => `${i + 1}. ${s}`).join('\n')}

INSTRUCTIONS
Return a JSON object with this exact structure:
{
  "primary": {
    "buildingType": "<one of the building types above>",
    "style": "<one of the styles above>",
    "storeys": <integer>,
    "approxFootprintM2": <integer, typical footprint in m²>,
    "approxHeightM": <number, storeys × 3 + 0.5>,
    "reasoning": "<2–3 sentences explaining why this is the optimal choice given the constraints and context>"
  },
  "alternatives": [
    { same structure, 3 items },
    { ... },
    { ... }
  ]
}

Rules:
- Respect ALL constraint overrides listed above (they are hard rules, not suggestions)
- Match the scale and character of nearby buildings unless there is a clear planning precedent for something different
- Each alternative must be a genuinely different building type (not just a style variant)
- approxHeightM = storeys × 3.0 + 0.5
- Return ONLY valid JSON. No markdown fences, no preamble.`
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 503 })
  }

  let siteContext: SiteContext
  let location: [number, number]
  try {
    const body = await request.json()
    siteContext = body.siteContext
    location = body.location
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!siteContext?.siteId || !Array.isArray(location) || location.length !== 2) {
    return NextResponse.json({ error: 'siteContext and location are required' }, { status: 400 })
  }

  const prompt = buildPrompt(siteContext, location as [number, number])

  const geminiBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingBudget: 1024 },
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

    // Parse and validate the recommendation
    let recommendation: BuildRecommendation
    try {
      const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
      const parsed = JSON.parse(cleaned)

      const validateOption = (o: unknown): o is BuildingOption =>
        typeof o === 'object' && o !== null &&
        typeof (o as BuildingOption).buildingType === 'string' &&
        typeof (o as BuildingOption).style === 'string' &&
        typeof (o as BuildingOption).storeys === 'number' &&
        typeof (o as BuildingOption).approxFootprintM2 === 'number' &&
        typeof (o as BuildingOption).approxHeightM === 'number' &&
        typeof (o as BuildingOption).reasoning === 'string'

      if (!validateOption(parsed.primary)) {
        throw new Error('Invalid primary option')
      }
      if (!Array.isArray(parsed.alternatives) || parsed.alternatives.length < 3) {
        throw new Error('Need exactly 3 alternatives')
      }

      recommendation = {
        primary: parsed.primary,
        alternatives: parsed.alternatives.slice(0, 3).filter(validateOption),
        activeIndex: 0,
      }

      if (recommendation.alternatives.length < 3) {
        throw new Error('Not enough valid alternatives')
      }
    } catch (parseErr) {
      return NextResponse.json(
        { error: `Failed to parse recommendation: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}` },
        { status: 502 },
      )
    }

    return NextResponse.json(recommendation)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Gemini request failed: ${message}` }, { status: 502 })
  }
}
