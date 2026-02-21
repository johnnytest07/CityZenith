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
    .map((o) => `${o.decision}: ${o.count} (${o.percentage.toFixed(0)}%)`)
    .join(', ')

  return `You are a senior planning consultant specialising in UK residential and mixed-use development.

Analyse the following site evidence and provide exactly 4 insight bullets — one for each category below.

PLANNING STATISTICS
- Total applications on record: ${summary.planningStats.totalApplications}
- Outcome distribution: ${outcomes || 'no data'}
- Average decision time: ${summary.planningStats.averageDecisionTimeDays != null ? `${summary.planningStats.averageDecisionTimeDays} days` : 'unknown'}
- Development activity level: ${summary.planningStats.activityLevel ?? 'unknown'}

STATUTORY CONSTRAINTS
- Active constraints: ${constraintList}

RECENT PLANNING APPLICATIONS (most recent first)
${appLines || 'No applications found'}

NEARBY BUILT CONTEXT (250 m radius)
- Visible buildings: ${summary.nearbyContext.buildingCount}
- Land use types: ${summary.nearbyContext.landUseTypes.join(', ') || 'unknown'}

INSTRUCTIONS
Return a JSON array with exactly 4 objects. Each object must have:
  - "category": one of "planning", "constraints", "built_form", "council"
  - "text": a single concise sentence (max 30 words) of actionable insight for that category

Categories:
- "planning": planning precedent signals (approval likelihood, what types are being approved/refused)
- "constraints": constraint implications for development type or scale
- "built_form": opportunity signals from the nearby built context
- "council": market activity context from council statistics

Return ONLY valid JSON array. No markdown fences, no preamble, no trailing text.
Example format:
[{"category":"planning","text":"..."},{"category":"constraints","text":"..."},{"category":"built_form","text":"..."},{"category":"council","text":"..."}]`
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
