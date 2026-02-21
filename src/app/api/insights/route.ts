import { NextRequest, NextResponse } from 'next/server'
import type { SiteContext, InsightBullet, InsightCategory } from '@/types/siteContext'
import { serialiseSiteContext, type SerialisedSiteContext } from '@/lib/serialiseSiteContext'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// Override with GEMINI_MODEL env var to target a different model
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-pro'

function buildPrompt(summary: SerialisedSiteContext): string {
  const constraintList = Object.entries(summary.constraints)
    .filter(([, active]) => active)
    .map(([type]) => type)
    .join(', ') || 'none identified'

  const appLines = summary.recentApplications
    .slice(0, 12)
    .map((a) => {
      const tags = a.isHighValue ? ` | HIGH VALUE: ${a.highValueTags.join(', ')}` : ''
      const speed = a.decisionSpeedDays != null ? ` | ${a.decisionSpeedDays}d to decide` : ''
      return `• [${a.decision ?? 'pending'}] ${a.proposal.slice(0, 160)} (${a.applicationType ?? 'unknown type'}, complexity: ${a.complexityScore}${tags}${speed})`
    })
    .join('\n')

  const outcomes = summary.planningStats.outcomeDistributions
    .map((o) => `${o.decision}: ${o.percentage.toFixed(0)}%`)
    .join(', ')

  const hs = summary.nearbyContext.heightStats
  const heightLine = hs
    ? `min ${hs.min}m / max ${hs.max}m / mean ${hs.mean}m / median ${hs.median}m (${Math.round(hs.median / 3)} storeys typical)`
    : 'no height data'

  const medianStoreys = hs ? Math.round(hs.median / 3) : 2
  const holdingCostLow = summary.planningStats.averageDecisionTimeDays != null
    ? Math.round(summary.planningStats.averageDecisionTimeDays * 300 / 1000)
    : null
  const holdingCostHigh = summary.planningStats.averageDecisionTimeDays != null
    ? Math.round(summary.planningStats.averageDecisionTimeDays * 800 / 1000)
    : null

  return `You are a senior real-estate development consultant briefing an institutional developer evaluating a UK site for new-build residential or mixed-use development. Your audience is a development director, not a homeowner. Focus on what drives a development decision: planning risk, development quantum, viability, and programme cost. Ignore minor domestic works — they are background noise, not signal.

Analyse the evidence below and return exactly 4 insight bullets, one per category.

PLANNING STATISTICS (council-wide)
- Total applications: ${summary.planningStats.totalApplications}
- Outcome split: ${outcomes || 'no data'}
- Avg decision time: ${summary.planningStats.averageDecisionTimeDays != null ? `${summary.planningStats.averageDecisionTimeDays} days` : 'unknown'}
- Activity level: ${summary.planningStats.activityLevel ?? 'unknown'}

STATUTORY CONSTRAINTS
- Active: ${constraintList}

RECENT APPLICATIONS ON THIS SITE (most recent first)
${appLines || 'No applications found'}

NEARBY BUILT CONTEXT (${summary.nearbyContext.queryRadiusM}m radius)
- Buildings visible: ${summary.nearbyContext.buildingCount}
- Building heights: ${heightLine}
- Land use types: ${summary.nearbyContext.landUseTypes.join(', ') || 'unknown'}

INSTRUCTIONS
Return a JSON array with exactly 4 objects. Each object:
  - "category": one of "planning", "constraints", "built_form", "council"
  - "text": ONE sentence, max 40 words, written for a development director

Strict rules per category:

- "planning": Scan the site applications. Discard garage conversions, single extensions, and householder works entirely — they are not relevant. Focus only on schemes with development significance: change of use to residential (C3/HMO/C2), new-build, conversion to flats, or commercial intensification. Did any such scheme succeed or fail here? What does that precedent tell a developer about planning risk for a residential or mixed-use scheme on this site? If no meaningful precedents exist, state that the site carries no local refusal risk from comparable schemes. Always cite a number.

- "constraints": If constraints are active, state the specific impact on development deliverability: Article 4 removes PD rights and requires full planning for every unit; Green Belt restricts new-build; Conservation Area requires materials sign-off; Flood Risk requires sequential test. If no constraints are active, name 2–3 development types that are now viable without needing constraint relief (e.g. C3 residential via full planning, prior approval conversions). Do not just say "no restrictions".

- "built_form": The nearby median height of ${hs?.median ?? 0}m implies a ${medianStoreys}-storey context. Translate this into a development quantum signal: a ${medianStoreys}-storey new-build or conversion on a typical 200–400m² urban plot could yield approximately ${medianStoreys * 2}–${medianStoreys * 3} units at 40–50m² NIA each. Frame this as a viability signal, not a design note — cite the median height and the implied unit count.

- "council": Frame the ${summary.planningStats.averageDecisionTimeDays ?? '?'}-day average decision time and ${outcomes} approval rate as hard programme and cost risk numbers for a developer.${holdingCostLow != null ? ` At typical development finance rates, a ${summary.planningStats.averageDecisionTimeDays}-day wait adds roughly £${holdingCostLow}k–£${holdingCostHigh}k in holding costs per £1m of GDV.` : ''} State whether this is a fast or slow council and whether the approval rate de-risks or adds risk to a speculative scheme.

Non-negotiable rules:
- Do NOT cite garage conversions, loft extensions, or householder works as the key planning finding.
- Every sentence must contain at least one number from the evidence above.
- Do NOT use vague phrases like "design freedom", "opportunity", "may offer", or "could potentially".
- Write as if you are presenting at a pre-acquisition board meeting.

Return ONLY a valid JSON array. No markdown, no preamble.
Example: [{"category":"planning","text":"..."},{"category":"constraints","text":"..."},{"category":"built_form","text":"..."},{"category":"council","text":"..."}]`
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 503 })
  }

  let siteContext: SiteContext
  try {
    const body = await request.json()
    siteContext = body.siteContext
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!siteContext?.siteId) {
    return NextResponse.json({ error: 'siteContext is required' }, { status: 400 })
  }

  const summary = serialiseSiteContext(siteContext)
  const prompt   = buildPrompt(summary)

  const geminiBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      // Thinking tokens count against maxOutputTokens on gemini-2.5-pro.
      // Budget 2048 for thinking + ~512 for the actual bullet points = 8192 headroom.
      maxOutputTokens: 8192,
      thinkingConfig: { thinkingBudget: 2048 },
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
    // When thinkingConfig is active, parts[0] is the reasoning block (thought: true)
    // and the actual answer is in a later part. Skip thought parts to find the text.
    const parts: Array<{ text?: string; thought?: boolean }> =
      data?.candidates?.[0]?.content?.parts ?? []
    const text: string = parts.find((p) => p.text && !p.thought)?.text ?? ''

    if (!text) {
      return NextResponse.json({ error: 'Gemini returned an empty response' }, { status: 502 })
    }

    // Parse structured bullets from JSON response
    let bullets: InsightBullet[] = []
    try {
      // Strip any accidental markdown fences
      const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
      const parsed = JSON.parse(cleaned)
      if (Array.isArray(parsed)) {
        const validCategories: InsightCategory[] = ['planning', 'constraints', 'built_form', 'council']
        bullets = parsed
          .filter((b: unknown): b is InsightBullet =>
            typeof b === 'object' && b !== null &&
            'category' in b && 'text' in b &&
            validCategories.includes((b as InsightBullet).category) &&
            typeof (b as InsightBullet).text === 'string',
          )
      }
    } catch {
      // Fallback: parse as bullet list lines and assign categories in order
      const categories: InsightCategory[] = ['planning', 'constraints', 'built_form', 'council']
      bullets = text.trim()
        .split('\n')
        .filter((l) => l.trim().startsWith('•'))
        .slice(0, 4)
        .map((l, i) => ({
          category: categories[i] ?? 'planning',
          text: l.replace(/^•\s*/, '').trim(),
        }))
    }

    // Build raw text for backward compat (map tooltip + InsightsPanel)
    const raw = bullets.length > 0
      ? bullets.map((b) => '• ' + b.text).join('\n')
      : text.trim()

    return NextResponse.json({ bullets, raw })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Gemini request failed: ${message}` }, { status: 502 })
  }
}
