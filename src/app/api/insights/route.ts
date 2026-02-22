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

async function embedQueryText(text: string, openai: any): Promise<number[]> {
  const t0 = Date.now()
  const res = await openai.embeddings.create({
    model: EMBED_MODEL,
    input: text,
  })
  const t1 = Date.now()
  try {
    console.log(`embedQueryText: generated embedding for ${String(text).slice(0, 60).replace(/\n/g, ' ')}... in ${t1 - t0}ms`)
  } catch {}
  return res.data[0].embedding
}

async function queryLocalPlan(
  planCorpus: string,
  queryText:  string,
  openai:     any,
  limit = 6,
): Promise<PlanChunkResult[]> {
  if (!process.env.MONGODB_URI) return []

  try {
    const clientPromise = (await import('@/lib/mongoClient')).default
    const client = await clientPromise
    const db = client.db(MONGO_DB)
    const tEmbedStart = Date.now()
    const queryVector = await embedQueryText(queryText, openai)
    const tEmbedEnd = Date.now()
    console.log(`queryLocalPlan: embedding for corpus=${planCorpus} took ${tEmbedEnd - tEmbedStart}ms`)

    const tDbStart = Date.now()
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
    const tDbEnd = Date.now()
    try {
      console.log(`queryLocalPlan: Mongo vectorSearch for corpus=${planCorpus} returned ${docs.length} docs in ${tDbEnd - tDbStart}ms`)
    } catch {}

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

  // Filter out domestic/householder works — not relevant for site assessment
  const substantiveApps = summary.recentApplications.filter((a) => {
    const p = a.proposal.toLowerCase()
    return !(
      p.includes('garage conversion') ||
      p.includes('loft conversion') ||
      p.includes('single storey extension') ||
      p.includes('rear extension') ||
      p.includes('side extension') ||
      p.includes('householder')
    )
  })

  const appLines = substantiveApps
    .slice(0, 10)
    .map((a) => {
      const tags    = a.isHighValue ? ` | HIGH VALUE: ${a.highValueTags.join(', ')}` : ''
      const speed   = a.decisionSpeedDays != null ? ` | ${a.decisionSpeedDays}d` : ''
      const units   = a.totalUnits != null ? ` | ${a.totalUnits} units` : (a.numNewHouses != null ? ` | ${a.numNewHouses} homes` : '')
      const mix     = a.unitMixSummary ? ` [${a.unitMixSummary}]` : ''
      const afford  = a.affordableUnits != null && a.totalUnits != null && a.totalUnits > 0
        ? ` | ${Math.round((a.affordableUnits / a.totalUnits) * 100)}% affordable`
        : ''
      const comments = a.numComments != null ? ` | ${a.numComments} comments` : ''
      const appeal  = a.appealDecision ? ` | APPEAL: ${a.appealDecision}` : ''
      return `  • [${a.decision ?? 'pending'}] ${a.proposal.slice(0, 120)} (${a.applicationType ?? 'unknown type'}, ${a.complexityScore}${tags}${speed}${units}${mix}${afford}${comments}${appeal})`
    })
    .join('\n')

  const outcomes = summary.planningStats.outcomeDistributions
    .map((o) => `${o.decision}: ${o.percentage.toFixed(0)}%`)
    .join(', ')

  const avgDays = summary.planningStats.averageDecisionTimeDays
  const holdingCostLow  = avgDays != null ? Math.round(avgDays * 300  / 1000) : null
  const holdingCostHigh = avgDays != null ? Math.round(avgDays * 800  / 1000) : null

  // Per-project-type decision times
  const decisionByType = Object.entries(summary.planningStats.decisionTimeByType)
    .map(([type, days]) => `${type}: ${days}d`)
    .join(', ')

  // Council pipeline
  const pl = summary.pipeline
  const pipelineSection = pl
    ? `
BOROUGH-WIDE HOUSING PIPELINE (${pl.councilName}, last ${pl.periodYears} years, approved residential only)
• ${pl.schemeCount} approved schemes totalling ${pl.totalNewHomesApproved.toLocaleString()} new homes
• Project type split: ${pl.projectTypeSplit}
• Average affordability ratio: ${pl.avgAffordabilityPct != null ? `${pl.avgAffordabilityPct}% affordable` : 'insufficient data'}
• Largest approved schemes:
${pl.largestSchemes.map((s) => `  - ${s.heading} (${s.units} units, ${s.decidedYear})`).join('\n')}`
    : ''

  const hs = summary.nearbyContext.heightStats
  const medianStoreys   = hs ? Math.max(1, Math.round(hs.median / 3)) : null
  const heightLine      = hs
    ? `• Heights (m): min ${hs.min}, max ${hs.max}, mean ${hs.mean}, median ${hs.median} → implies ~${medianStoreys}-storey context`
    : '• Heights: no height data available'

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

  const holdingCostNote = holdingCostLow != null
    ? `• Holding cost proxy: £${holdingCostLow}k–£${holdingCostHigh}k per £1m GDV (based on ${avgDays}-day average decision time at £300–£800/day finance cost)`
    : ''

  return `You are a senior UK planning consultant with deep knowledge of local planning policy.

${roleIntro}

SITE EVIDENCE ──────────────────────────────────────────────────────────────────

PLANNING STATISTICS (${council})
• Total applications: ${summary.planningStats.totalApplications} (domestic/householder works excluded from analysis)
• Outcomes: ${outcomes || 'no data'}
• Avg decision time: ${avgDays != null ? `${avgDays} days` : 'unknown'}${decisionByType ? ` (by type: ${decisionByType})` : ''}
• New homes approved (5yr): ${summary.planningStats.newHomesApproved5yr ?? 'unknown'}
• Activity level: ${summary.planningStats.activityLevel ?? 'unknown'}
${holdingCostNote}

STATUTORY CONSTRAINTS
• Active: ${constraintList}

RECENT SUBSTANTIVE PLANNING APPLICATIONS (most recent first; garage/loft/householder excluded)
${appLines || '  No substantive applications found'}

NEARBY BUILT CONTEXT (${summary.nearbyContext.queryRadiusM}m radius)
• Buildings visible: ${summary.nearbyContext.buildingCount}
• Land use types: ${summary.nearbyContext.landUseTypes.join(', ') || 'unknown'}
${heightLine}
${medianStoreys != null ? `• Unit quantum: a ${medianStoreys}-storey new-build on a typical 200–400m² urban plot could yield ~${medianStoreys * 2}–${medianStoreys * 3} units at 40–50m² NIA each` : ''}

CONNECTIVITY & AMENITIES (1km radius, OSM data)
${summary.amenities.length > 0
  ? summary.amenities.map((a) => `• ${a.label}: ${a.nearest}`).join('\n')
  : '• No amenity data available'}
${pipelineSection}
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
• Generate 10–14 insight items total, aiming for 2–3 items per category
• Valid categories: "planning", "constraints", "built_form", "council", "connectivity"
• Valid priorities: "high" (immediate relevance), "medium" (relevant context), "low" (background)
• Make each item distinct — no duplication across categories
• Every sentence in "detail" must contain at least one specific number, percentage, distance, or named policy — no vague phrases like "significant" or "notable" without a figure
• If local plan policies are provided above, cite specific policy codes in detail and evidenceSources
• Order items with highest-priority first
• Per-category guidance:
  - planning: lead with approval rate and the most relevant substantive decision types; flag any refused applications, their grounds, and whether appeals overturned them; if unit mix data is present cite actual bedroom mix and affordability ratio being approved nearby
  - constraints: state each active constraint and its direct deliverability implication (e.g. Green Belt → very special circumstances required; Conservation Area → heritage impact assessment mandatory)
  - built_form: anchor typology recommendation to the median height/storeys context and estimated unit quantum; include specific height numbers; if nearby schemes have floor area data, reference GIA benchmarks
  - council: frame decision time as programme and cost risk using the holding cost figures above; cite per-project-type decision times where available (large residential takes longer than home improvement); if borough pipeline data is present, contextualise against total new homes approved and affordability ratio required
  - connectivity: assess public transport accessibility using the actual station names and walking times in the data; flag any gaps (e.g. nearest rail >800m, no bus within 400m); note amenity completeness (supermarket, school, green space) and any planning implications such as car-dependency risk or S106 contributions toward transport`
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

    const validCategories: InsightCategory[] = ['planning', 'constraints', 'built_form', 'council', 'connectivity']
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

/**
 * Wrap a promise with a timeout so slow external services can't block the route.
 * Resolves/rejects as the underlying promise, or rejects with Error('timeout')
 * after `ms` milliseconds.
 */
function withTimeout<T>(promise: Promise<T>, ms = 3500): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then((v) => { clearTimeout(id); resolve(v) }, (e) => { clearTimeout(id); reject(e) })
  })
}

export async function POST(request: NextRequest) {
  const reqId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`
  try { console.log(`[/api/insights req:${reqId}] start`) } catch {}
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) {
    console.warn(`[/api/insights req:${reqId}] GEMINI_API_KEY not configured`)
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured', reqId }, { status: 503 })
  }

  const openaiKey = process.env.OPENAI_API_KEY
  const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null

  let siteContext: SiteContext
  let role:       'council' | 'developer' = 'developer'
  let council     = 'Unknown Council'
  let planCorpus: string | null = null

  try {
    // Read raw body so we can log malformed payloads for debugging
    const raw = await request.text()
    let parsed: any
    try {
      parsed = raw ? JSON.parse(raw) : {}
    } catch (err) {
      console.warn(`[/api/insights req:${reqId}] Invalid JSON body:`, raw.slice(0, 200))
      throw new Error('Invalid JSON body or missing siteContext')
    }

    const body = parsed as {
      siteContext?: SiteContext
      role?:        string
      council?:     string
      planCorpus?:  string
    }
    // Log minimal request info for debugging repeated 400s
    try {
      console.log(`[/api/insights req:${reqId}] incoming request`, {
        hasSiteContext: Boolean(body.siteContext),
        siteId: body.siteContext?.siteId,
        planCorpus: body.planCorpus,
        role: body.role,
        council: body.council,
      })
    } catch {}

    if (!body.siteContext) {
      console.warn(`[/api/insights req:${reqId}] Missing siteContext; keys:`, Object.keys(body))
      throw new Error('missing siteContext')
    }
    siteContext = body.siteContext
    if (body.role === 'council' || body.role === 'developer') role = body.role
    if (typeof body.council    === 'string') council    = body.council
    if (typeof body.planCorpus === 'string') planCorpus = body.planCorpus
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body or missing siteContext' }, { status: 400 })
  }

    if (!siteContext?.siteId) {
    console.warn(`[/api/insights req:${reqId}] Missing siteContext.siteId; siteContext keys:`, Object.keys(siteContext ?? {}))
    return NextResponse.json({ error: 'siteContext.siteId is required', reqId }, { status: 400 })
  }

  const summary = serialiseSiteContext(siteContext)

  // Query local plan if a corpus is available for this council
  let planChunks: PlanChunkResult[] = []
  let vectorSearchTimedOut = false
  if (planCorpus && openai) {
    const searchQuery = buildPlanSearchQuery(summary)
    try {
      // Bound the vector search + embedding time so a slow DB or network doesn't block
      planChunks = await withTimeout(queryLocalPlan(planCorpus, searchQuery, openai), 3500)
    } catch (err) {
      // On timeout or error, continue without plan context (non-fatal)
      console.warn(`[/api/insights req:${reqId}] Local plan vector search failed or timed out; continuing without plan context`, err)
      // indicate to the client that the vector search did not complete
      vectorSearchTimedOut = true
      planChunks = []
    }
  } else if (planCorpus && !openai) {
    console.warn('OPENAI_API_KEY not set; skipping local plan vector search')
  }

  const prompt = buildPrompt(summary, role, council, planChunks)

  const geminiBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature:     0.3,
      maxOutputTokens: 8192,
      // Note: 'thinkingConfig' is not supported by all Gemini endpoints / API versions.
      // It caused INVALID_ARGUMENT errors in some environments, so we omit it here.
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
      console.warn(`[/api/insights req:${reqId}] Gemini API error ${res.status}`, err)
      return NextResponse.json(
        { error: `Gemini API error (${res.status})`, details: err, vectorSearchTimedOut, reqId },
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
      console.warn(`[/api/insights req:${reqId}] Gemini returned empty response`)
      return NextResponse.json({ error: 'Gemini returned an empty response', vectorSearchTimedOut, reqId }, { status: 502 })
    }

    const report = parseInsightsReport(text, role, council)

    if (!report) {
      console.warn(`[/api/insights req:${reqId}] Could not parse structured insights`)
      return NextResponse.json(
        { error: 'Could not parse structured insights from response', raw: text, vectorSearchTimedOut, reqId },
        { status: 502 },
      )
    }

    // Backward-compatible bullets + raw for legacy consumers
    const validCategories: InsightCategory[] = ['planning', 'constraints', 'built_form', 'council', 'connectivity']
    const bullets = report.items
      .filter((item) => validCategories.includes(item.category))
      .map((item) => ({ category: item.category, text: item.headline }))
    const raw = report.items.map((item) => `• ${item.headline}`).join('\n')

    console.log(`[/api/insights req:${reqId}] returning report with ${report.items.length} items`)
    return NextResponse.json({ report, bullets, raw, vectorSearchTimedOut, reqId })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[/api/insights req:${reqId}] Gemini request failed: ${message}`)
    return NextResponse.json({ error: `Gemini request failed: ${message}`, vectorSearchTimedOut, reqId }, { status: 502 })
  }
}
