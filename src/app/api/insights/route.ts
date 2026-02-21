import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import type { SiteContext, InsightCategory } from '@/types/siteContext'
import type { InsightsReport, InsightItem, InsightPriority } from '@/types/insights'
import { serialiseSiteContext, type SerialisedSiteContext } from '@/lib/serialiseSiteContext'

const GEMINI_BASE    = 'https://generativelanguage.googleapis.com/v1'
const EMBED_MODEL    = 'text-embedding-3-small'
const GEMINI_MODEL   = process.env.GEMINI_MODEL ?? 'gemini-2.5-pro'
const MONGO_DB       = process.env.MONGODB_DB ?? 'cityzenith'
const PLAN_COLLECTION   = 'council_plan_chunks'
const VECTOR_INDEX_NAME = 'vector_index'

// ─── Local plan retrieval ─────────────────────────────────────────────────────

interface PlanChunkResult {
  section:     string
  sectionType: string
  text:        string
  pageStart:   number
  score:       number
}

async function embedQueryText(text: string, openai: OpenAI): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: EMBED_MODEL,
    input: text,
  })
  return res.data[0].embedding
}

async function queryLocalPlan(
  planCorpus: string,
  queryText:  string,
  openai:     OpenAI,
  limit = 6,
): Promise<PlanChunkResult[]> {
  if (!process.env.MONGODB_URI) return []

  try {
    const clientPromise = (await import('@/lib/mongoClient')).default
    const client = await clientPromise
    const db = client.db(MONGO_DB)

    const queryVector = await embedQueryText(queryText, openai)

    const docs = await db.collection(PLAN_COLLECTION).aggregate([
      {
        $vectorSearch: {
          index:         VECTOR_INDEX_NAME,
          path:          'embedding',
          queryVector,
          numCandidates: limit * 10,
          limit,
          filter:        { council: planCorpus },
        },
      },
      {
        $project: {
          _id:         0,
          embedding:   0,
          section:     1,
          sectionType: 1,
          text:        1,
          pageStart:   1,
          score:       { $meta: 'vectorSearchScore' },
        },
      },
    ]).toArray()

    return docs as PlanChunkResult[]
  } catch {
    // MongoDB unavailable or index not built yet — continue without plan context
    return []
  }
}

/** Build a plan search query from the site context evidence. */
function buildPlanSearchQuery(summary: SerialisedSiteContext): string {
  const constraints = Object.entries(summary.constraints)
    .filter(([, active]) => active)
    .map(([type]) => type)
    .join(' ')

  const appTypes = [...new Set(
    summary.recentApplications.map((a) => a.applicationType).filter(Boolean),
  )].slice(0, 3).join(' ')

  return `planning permission development ${constraints} ${appTypes}`.trim()
}

// ─── Prompt construction ──────────────────────────────────────────────────────

function buildPrompt(
  summary:    SerialisedSiteContext,
  role:       'council' | 'developer',
  council:    string,
  planChunks: PlanChunkResult[],
): string {
  const constraintList = Object.entries(summary.constraints)
    .filter(([, active]) => active)
    .map(([type]) => type)
    .join(', ') || 'none identified'

  const appLines = summary.recentApplications
    .slice(0, 10)
    .map((a) => {
      const tags  = a.isHighValue ? ` | HIGH VALUE: ${a.highValueTags.join(', ')}` : ''
      const speed = a.decisionSpeedDays != null ? ` | ${a.decisionSpeedDays}d` : ''
      return `  • [${a.decision ?? 'pending'}] ${a.proposal.slice(0, 140)} (${a.applicationType ?? 'unknown type'}, ${a.complexityScore}${tags}${speed})`
    })
    .join('\n')

  const outcomes = summary.planningStats.outcomeDistributions
    .map((o) => `${o.decision}: ${o.count} (${o.percentage.toFixed(0)}%)`)
    .join(', ')

  const planContext = planChunks.length > 0
    ? [
        '',
        'LOCAL PLAN CONTEXT (relevant policies and supporting text)',
        ...planChunks.map((c) =>
          `  [${c.sectionType.toUpperCase()} – ${c.section}, p.${c.pageStart}]\n  ${c.text.slice(0, 600)}`,
        ),
      ].join('\n')
    : ''

  const roleIntro = role === 'developer'
    ? 'The user is a DEVELOPER assessing this site. Focus on: approval likelihood, development constraints, density/typology signals, and investment opportunity.'
    : 'The user is a COUNCIL OFFICER evaluating development proposals. Focus on: policy compliance, constraint management, design quality, and precedent-setting.'

  return `You are a senior UK planning consultant with deep knowledge of local planning policy.

${roleIntro}

SITE EVIDENCE ──────────────────────────────────────────────────────────────────

PLANNING STATISTICS (${council})
• Total applications: ${summary.planningStats.totalApplications}
• Outcomes: ${outcomes || 'no data'}
• Avg decision time: ${summary.planningStats.averageDecisionTimeDays != null ? `${summary.planningStats.averageDecisionTimeDays} days` : 'unknown'}
• Activity level: ${summary.planningStats.activityLevel ?? 'unknown'}

STATUTORY CONSTRAINTS
• Active: ${constraintList}

RECENT PLANNING APPLICATIONS (most recent first)
${appLines || '  No applications found'}

NEARBY BUILT CONTEXT (250 m radius)
• Buildings visible: ${summary.nearbyContext.buildingCount}
• Land use types: ${summary.nearbyContext.landUseTypes.join(', ') || 'unknown'}
${planContext}

TASK ───────────────────────────────────────────────────────────────────────────

Analyse this site thoroughly, then return a structured JSON insights report.

For each insight: first think through the detailed evidence (this becomes "detail"),
then distil it to a punchy headline (this becomes "headline").

Return ONLY valid JSON — no markdown fences, no preamble, no trailing text:
{
  "summary": "2–3 sentence overall assessment for a ${role === 'developer' ? 'developer' : 'council officer'}",
  "items": [
    {
      "id": "planning-1",
      "category": "planning",
      "priority": "high",
      "headline": "Punchy headline, max 12 words",
      "detail": "2–4 sentences of specific, evidence-grounded analysis. Reference actual application types, decisions, policies, or statistics.",
      "evidenceSources": ["IBEX planning data", "Local Plan Policy H1"]
    }
  ]
}

Rules:
• Generate 5–7 insight items total
• Valid categories: "planning", "constraints", "built_form", "council"
• Valid priorities: "high" (immediate relevance), "medium" (relevant context), "low" (background)
• Make each item distinct — no duplication across categories
• If local plan policies are provided above, cite specific policy codes in detail and evidenceSources
• Order items with highest-priority first`
}

// ─── Response parsing ─────────────────────────────────────────────────────────

function parseInsightsReport(
  text:    string,
  role:    'council' | 'developer',
  council: string,
): InsightsReport | null {
  try {
    const cleaned = text.trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
    const parsed = JSON.parse(cleaned) as {
      summary?: unknown
      items?:   unknown[]
    }

    if (!parsed.summary || !Array.isArray(parsed.items)) return null

    const validCategories: InsightCategory[] = ['planning', 'constraints', 'built_form', 'council']
    const validPriorities: InsightPriority[]  = ['high', 'medium', 'low']

    const items: InsightItem[] = (parsed.items as Record<string, unknown>[])
      .filter((item) =>
        typeof item === 'object' && item !== null &&
        validCategories.includes(item['category'] as InsightCategory) &&
        validPriorities.includes(item['priority'] as InsightPriority) &&
        typeof item['headline'] === 'string' &&
        typeof item['detail']   === 'string',
      )
      .map((item, idx) => ({
        id:              typeof item['id'] === 'string' ? item['id'] : `item-${idx}`,
        category:        item['category'] as InsightCategory,
        priority:        item['priority'] as InsightPriority,
        headline:        item['headline'] as string,
        detail:          item['detail'] as string,
        evidenceSources: Array.isArray(item['evidenceSources'])
          ? (item['evidenceSources'] as unknown[]).filter((s): s is string => typeof s === 'string')
          : [],
      }))

    return {
      summary:     String(parsed.summary),
      items,
      role,
      council,
      generatedAt: new Date().toISOString(),
    }
  } catch {
    return null
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 503 })
  }

  const openaiKey = process.env.OPENAI_API_KEY
  const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null

  let siteContext: SiteContext
  let role:       'council' | 'developer' = 'developer'
  let council     = 'Unknown Council'
  let planCorpus: string | null = null

  try {
    const body = await request.json() as {
      siteContext?: SiteContext
      role?:        string
      council?:     string
      planCorpus?:  string
    }
    if (!body.siteContext) throw new Error('missing siteContext')
    siteContext = body.siteContext
    if (body.role === 'council' || body.role === 'developer') role = body.role
    if (typeof body.council    === 'string') council    = body.council
    if (typeof body.planCorpus === 'string') planCorpus = body.planCorpus
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body or missing siteContext' }, { status: 400 })
  }

  if (!siteContext?.siteId) {
    return NextResponse.json({ error: 'siteContext.siteId is required' }, { status: 400 })
  }

  const summary = serialiseSiteContext(siteContext)

  // Query local plan if a corpus is available for this council
  let planChunks: PlanChunkResult[] = []
  if (planCorpus && openai) {
    const searchQuery = buildPlanSearchQuery(summary)
    planChunks = await queryLocalPlan(planCorpus, searchQuery, openai)
  } else if (planCorpus && !openai) {
    console.warn('OPENAI_API_KEY not set; skipping local plan vector search')
  }

  const prompt = buildPrompt(summary, role, council, planChunks)

  const geminiBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature:     0.3,
      maxOutputTokens: 8192,
      // Thinking budget: 4096 for reasoning + headroom for the JSON output
      thinkingConfig:  { thinkingBudget: 4096 },
    },
  }

  try {
    const res = await fetch(
      `${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(geminiBody),
      },
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: `Gemini API error (${res.status})`, details: err },
        { status: res.status },
      )
    }

    const data = await res.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string; thought?: boolean }> }
      }>
    }

    // When thinkingConfig is active, skip thought parts to find the actual text
    const parts = data?.candidates?.[0]?.content?.parts ?? []
    const text  = parts.find((p) => p.text && !p.thought)?.text ?? ''

    if (!text) {
      return NextResponse.json({ error: 'Gemini returned an empty response' }, { status: 502 })
    }

    const report = parseInsightsReport(text, role, council)

    if (!report) {
      return NextResponse.json(
        { error: 'Could not parse structured insights from response', raw: text },
        { status: 502 },
      )
    }

    // Backward-compatible bullets + raw for legacy consumers
    const validCategories: InsightCategory[] = ['planning', 'constraints', 'built_form', 'council']
    const bullets = report.items
      .filter((item) => validCategories.includes(item.category))
      .map((item) => ({ category: item.category, text: item.headline }))
    const raw = report.items.map((item) => `• ${item.headline}`).join('\n')

    return NextResponse.json({ report, bullets, raw })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Gemini request failed: ${message}` }, { status: 502 })
  }
}
