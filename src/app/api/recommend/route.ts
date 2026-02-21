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

function buildPrompt(
  siteContext: SiteContext,
  polygon: [number, number][],
  footprintM2: number,
): string {
  const stats = siteContext.planningContextStats
  const constraints = siteContext.statutoryConstraints

  // Centroid for location display
  const centroidLng = polygon.reduce((s, p) => s + p[0], 0) / polygon.length
  const centroidLat = polygon.reduce((s, p) => s + p[1], 0) / polygon.length

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

  // ── Detailed nearby building analysis ─────────────────────────────────────
  const buildings = siteContext.nearbyContextFeatures.buildings.features

  const heights = buildings
    .map((f) => {
      const h = f.properties?.render_height ?? f.properties?.height
      return typeof h === 'number' ? h : typeof h === 'string' ? parseFloat(h) : NaN
    })
    .filter((h) => !isNaN(h) && h > 0)
    .sort((a, b) => a - b)

  // Height → implied storeys band (UK floor-to-floor ~3m)
  const storeyCounts = heights.map((h) => {
    if (h <= 4.5) return 1
    if (h <= 7.5) return 2
    if (h <= 10.5) return 3
    if (h <= 13.5) return 4
    if (h <= 19) return 5
    return Math.round(h / 3)
  })

  // Storey distribution: how many buildings at each storey count
  const storeyBuckets: Record<number, number> = {}
  for (const s of storeyCounts) storeyBuckets[s] = (storeyBuckets[s] ?? 0) + 1
  const storeyDistribution = Object.entries(storeyBuckets)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([s, n]) => `${s}-storey: ${n} building${n > 1 ? 's' : ''}`)
    .join(', ')

  const dominantStoreys = storeyCounts.length > 0
    ? Number(Object.entries(storeyBuckets).sort(([, a], [, b]) => b - a)[0][0])
    : null

  const minHeight = heights.length > 0 ? heights[0].toFixed(1) : 'unknown'
  const maxHeight = heights.length > 0 ? heights[heights.length - 1].toFixed(1) : 'unknown'
  const avgHeight = heights.length > 0
    ? (heights.reduce((a, b) => a + b, 0) / heights.length).toFixed(1)
    : 'unknown'
  const medianHeight = heights.length > 0
    ? heights[Math.floor(heights.length / 2)].toFixed(1)
    : 'unknown'

  // Extract any OSM building-type tags from vector tile features
  const buildingTypeTags = Array.from(
    new Set(
      buildings
        .map((f) =>
          f.properties?.building ??
          f.properties?.['building:use'] ??
          f.properties?.amenity,
        )
        .filter((v): v is string => typeof v === 'string' && v !== 'yes'),
    ),
  ).slice(0, 8)

  const landuseTags = Array.from(
    new Set(
      siteContext.nearbyContextFeatures.landuse.features
        .map((f) => f.properties?.landuse ?? f.properties?.leisure ?? f.properties?.natural)
        .filter(Boolean),
    ),
  )
    .slice(0, 6)
    .join(', ')

  // ── Neighbourhood character summary ────────────────────────────────────────
  let characterSummary = 'Unknown — no height data available'
  if (dominantStoreys !== null) {
    if (dominantStoreys <= 1) characterSummary = 'Low-density bungalow / single-storey'
    else if (dominantStoreys === 2) characterSummary = 'Predominantly 2-storey residential (typical London terrace/semi)'
    else if (dominantStoreys === 3) characterSummary = 'Mid-density 3-storey townhouse / Victorian terrace'
    else if (dominantStoreys <= 5) characterSummary = 'Medium-rise 4–5 storeys, likely conversion flats or small blocks'
    else characterSummary = 'Higher-density urban, 6+ storeys'
  }

  // ── Recent planning application types (local precedent) ────────────────────
  const recentAppTypes = siteContext.planningPrecedentFeatures.features
    .slice(0, 15)
    .map((f) => f.properties?.normalised_application_type ?? f.properties?.application_type)
    .filter((v): v is string => typeof v === 'string')
  const uniqueRecentTypes = Array.from(new Set(recentAppTypes)).slice(0, 5).join(', ')

  // ── Planning stats ─────────────────────────────────────────────────────────
  const approvalRate = stats?.approval_rate != null
    ? `${(stats.approval_rate * 100).toFixed(0)}%`
    : 'unknown'
  const activityLevel = stats?.council_development_activity_level ?? 'unknown'

  const appTypes = stats?.number_of_applications
    ? Object.entries(stats.number_of_applications)
        .filter(([, v]) => v > 0)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
    : 'unknown'

  const roundedArea = Math.round(footprintM2)

  // Storey cap: don't allow taller than what planning evidence supports unless there's a strong reason
  const softStoreyMax = dominantStoreys != null ? dominantStoreys + 2 : 6

  return `You are a senior UK property development consultant. Your primary job is to recommend a realistic building that FITS the existing street character around this site.

LOCATION: approximately ${centroidLat.toFixed(5)}°N, ${centroidLng.toFixed(5)}°E

━━━ DRAWN SITE FOOTPRINT ━━━
Fixed area: ${roundedArea}m² (DO NOT change approxFootprintM2 for any option)

━━━ STATUTORY CONSTRAINTS (hard rules — no exceptions) ━━━
${constraintNotes.length > 0 ? constraintNotes.map((n) => `• ${n}`).join('\n') : '• None — no active statutory constraints'}
${constraintNotes.length > 0 ? `\n⚠ CONSTRAINT ENFORCEMENT — these constraints apply to EVERY option and alternative without exception.\nDo NOT mention constraints only in the primary option. They apply equally to all options.\nEach constraint listed above MUST appear in:\n  (a) the reasoning text of EVERY option (primary + all 3 alternatives)\n  (b) at least one factor entry in EVERY option's factors[] array` : ''}

━━━ NEARBY BUILT CONTEXT — 250m radius ━━━
Total buildings observed: ${buildings.length}
${heights.length > 0 ? `
Height statistics:
  • Min: ${minHeight}m  Avg: ${avgHeight}m  Median: ${medianHeight}m  Max: ${maxHeight}m
  • Storey distribution: ${storeyDistribution}
  • DOMINANT storey count: ${dominantStoreys ?? 'unknown'} storeys (this is the prevailing street height)
  • Neighbourhood character: ${characterSummary}
  • Recommended storey range to match local character: ${dominantStoreys ?? 1}–${softStoreyMax} storeys
` : '  • No height data in tiles — assume 2-storey residential as default'}
${buildingTypeTags.length > 0 ? `Building type tags from map: ${buildingTypeTags.join(', ')}` : ''}
Adjacent land uses: ${landuseTags || 'residential (assumed)'}

━━━ LOCAL PLANNING PRECEDENT ━━━
Council approval rate: ${approvalRate}
Development activity level: ${activityLevel}
Application types (council-wide): ${appTypes}
Recent site application types: ${uniqueRecentTypes || 'none found'}

━━━ HEIGHT REFERENCE TABLE ━━━
Use these realistic heights (NOT a simple storeys × 3 formula):
• Bungalow (1 storey): 3.5–4.5m
• 2-storey house: 6.0–7.5m
• 3-storey townhouse: 8.5–10.0m
• 4-storey terrace/mansion block: 11.5–13.5m
• 5-storey small block: 14.0–16.0m
• 6-storey block of flats: 17.0–19.5m

━━━ AVAILABLE BUILDING TYPES ━━━
${BUILDING_TYPES.map((t, i) => `${i + 1}. ${t}`).join('\n')}

━━━ AVAILABLE STYLES ━━━
${STYLES.map((s, i) => `${i + 1}. ${s}`).join('\n')}

━━━ INSTRUCTIONS ━━━
Return a JSON object with this exact structure — no markdown, no preamble:
{
  "primary": {
    "buildingType": "<BEST FIT for the local street character>",
    "style": "<style that matches or complements existing nearby buildings>",
    "storeys": <integer — match dominant local height unless you have strong planning reason not to>,
    "approxFootprintM2": ${roundedArea},
    "approxHeightM": <realistic height in metres from the table above — NOT storeys × 3>,
    "reasoning": [
      "<bullet 1: how this fits local street character — cite dominant storey count and avg height>",
      "<bullet 2: planning evidence — approval rate, recent app types, activity level>",
      "<bullet 3: any statutory constraints and their implication, or 'No active statutory constraints' if none>",
      "<bullet 4: overall likelihood of success and key risk if any>"
    ],
    "factors": [
      { "label": "<≤20 chars>", "value": "<actual data value>", "impact": "positive" | "neutral" | "negative" },
      ... 4–5 factors
    ]
  },
  "alternatives": [
    {
      ALTERNATIVE 1: A SHORTER / SMALLER option than primary (match or go below dominant local height)
      "buildingType": "...", "style": "...", "storeys": ..., "approxFootprintM2": ${roundedArea}, "approxHeightM": ...,
      "reasoning": ["<bullet 1>", "<bullet 2>", "<bullet 3>"], "factors": [...]
    },
    {
      ALTERNATIVE 2: A TALLER / DENSER option (push the planning envelope — justify with precedent or approval rate)
      "buildingType": "...", "style": "...", "storeys": ..., "approxFootprintM2": ${roundedArea}, "approxHeightM": ...,
      "reasoning": ["<bullet 1>", "<bullet 2>", "<bullet 3>"], "factors": [...]
    },
    {
      ALTERNATIVE 3: A DIFFERENT USE CLASS (mixed-use, commercial, live-work — must differ in building type, not just style)
      "buildingType": "...", "style": "...", "storeys": ..., "approxFootprintM2": ${roundedArea}, "approxHeightM": ...,
      "reasoning": ["<bullet 1>", "<bullet 2>", "<bullet 3>"], "factors": [...]
    }
  ]
}

Critical rules:
1. PRIMARY must closely match the dominant local street character (${dominantStoreys ?? 2} storeys, ${avgHeight}m avg)
2. Each alternative must differ in building TYPE and scale — not just style
3. approxHeightM must come from the reference table above, not a formula
4. approxFootprintM2 = ${roundedArea} for all options always
5. Constraint hard rules override everything else
6. Factor "value" fields MUST contain actual numbers from the site evidence
${constraintNotes.length > 0
  ? `7. MANDATORY — every single option and alternative (primary + all 3 alternatives) MUST include one factor per active constraint:
${constraintNotes.map((n) => {
  const tag = n.split(':')[0].trim()
  if (tag === 'GREEN BELT') return '   • Green Belt → { "label": "Green Belt", "value": "New-build flats excluded", "impact": "negative" }'
  if (tag === 'CONSERVATION AREA') return '   • Conservation Area → { "label": "Conservation Area", "value": "Traditional materials required", "impact": "negative" }'
  if (tag === 'FLOOD RISK') return '   • Flood Risk → { "label": "Flood Risk", "value": "Raised ground floor required", "impact": "negative" }'
  if (tag === 'ARTICLE 4') return '   • Article 4 → { "label": "Article 4", "value": "Full planning required, no PD rights", "impact": "negative" }'
  return `   • ${tag} → include as a negative factor`
}).join('\n')}
   If a constraint is active, it applies to the site — not just the primary option.`
  : ''}`
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 503 })
  }

  let siteContext: SiteContext
  let polygon: [number, number][]
  let footprintM2: number
  try {
    const body = await request.json()
    siteContext = body.siteContext
    polygon = body.polygon
    footprintM2 = body.footprintM2
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (
    !siteContext?.siteId ||
    !Array.isArray(polygon) ||
    polygon.length < 3 ||
    typeof footprintM2 !== 'number'
  ) {
    return NextResponse.json(
      { error: 'siteContext, polygon (3+ points), and footprintM2 are required' },
      { status: 400 },
    )
  }

  const prompt = buildPrompt(siteContext, polygon, footprintM2)

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

      const validateOption = (o: unknown): o is BuildingOption => {
        if (typeof o !== 'object' || o === null) return false
        const opt = o as BuildingOption
        if (
          typeof opt.buildingType !== 'string' ||
          typeof opt.style !== 'string' ||
          typeof opt.storeys !== 'number' ||
          typeof opt.approxFootprintM2 !== 'number' ||
          typeof opt.approxHeightM !== 'number'
        ) return false
        // Normalise reasoning: accept string (legacy) or array
        const rawReasoning = (opt as unknown as { reasoning: unknown }).reasoning
        if (typeof rawReasoning === 'string') {
          opt.reasoning = rawReasoning.split(/(?<=\.\s)/).map((s: string) => s.trim()).filter(Boolean)
        } else if (!Array.isArray(rawReasoning)) {
          opt.reasoning = []
        }
        // Normalise missing/malformed factors to an empty array rather than rejecting
        if (!Array.isArray(opt.factors)) opt.factors = []
        return true
      }

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
        {
          error: `Failed to parse recommendation: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
        },
        { status: 502 },
      )
    }

    return NextResponse.json(recommendation)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Gemini request failed: ${message}` }, { status: 502 })
  }
}
