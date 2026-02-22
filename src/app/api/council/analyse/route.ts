import { NextRequest } from 'next/server'
import clientPromise from '@/lib/mongoClient'
import { buffer as turfBuffer } from '@turf/turf'
import type { CouncilSuggestion, AnalysisStage, ImplementationOption } from '@/types/council'
import { queryLocalPlan, type PlanChunkResult } from '@/lib/queryLocalPlan'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

interface AnalysisRequest {
  region: string
  bounds: [number, number, number, number]
  council: string
  planCorpus: string | null
  force?: boolean
}

interface GeminiSuggestionRaw {
  title: string
  type: string
  status: string
  rationale: string
  reasoning: string
  priority: 'high' | 'medium' | 'low'
  centerPoint: [number, number]
  radiusM: number
  evidenceSources: string[]
  policyBasis: string
  problem: string
  overallOutcome: string
  relatedToTitle: string | null
  implementations: Array<{
    type: string
    title: string
    description: string
    centerPoint: [number, number]
    radiusM: number
    heightM: number | null
    color: [number, number, number, number]
    policyBasis: string
    order: number
    projectedEffect: string
  }>
}

interface CachedStageResult {
  stageNum: number
  name: string
  description: string
  suggestions: CouncilSuggestion[]
}

interface CachedAnalysis {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _id: any
  council: string
  bounds: [number, number, number, number]
  stageResults: CachedStageResult[]
  updatedAt: Date
}

const ANALYSIS_STAGES: Array<{ stageNum: number; name: string; description: string; focus: string }> = [
  { stageNum: 1,  name: 'Land use & vacancy audit',                description: 'Identifying underutilised and vacant parcels across the region.',                                      focus: 'Vacant, underutilised and brownfield sites. Identify industrial decline, empty parcels, and low-density land with higher-use potential. Reference local plan brownfield and land use policies.' },
  { stageNum: 2,  name: 'Statutory constraint mapping',            description: 'Mapping constraint-burdened zones and assessing proportionality to planning need.',                    focus: 'Green Belt, Flood Risk Zones, Conservation Areas, Article 4 Directions. Map constraint-burdened zones. Assess whether constraints are proportionate to planning need.' },
  { stageNum: 3,  name: 'Planning performance analysis',           description: 'Detecting refusal clusters, stalled schemes, and systemic delivery blockages.',                        focus: 'Refusal clusters, stalled schemes, and sites with repeated delivery failure. Identify systemic application failure patterns and viability blockages.' },
  { stageNum: 4,  name: 'Local plan opportunity areas',            description: 'Extracting regeneration allocations and strategic sites from the adopted Local Plan.',                  focus: 'Regeneration allocations, opportunity areas, and strategic housing sites from the adopted Local Plan. Cross-reference designations with actual delivery track record.' },
  { stageNum: 5,  name: 'Housing delivery & pipeline',             description: 'Comparing approved pipeline to housing targets and identifying acute under-delivery zones.',           focus: '5-year housing land supply gap. Compare approved pipeline to housing targets. Identify areas of acute under-delivery.' },
  { stageNum: 6,  name: 'Green & blue infrastructure deficit',     description: 'Measuring open space and green infrastructure provision against Fields in Trust standards.',           focus: 'Open space and accessible green infrastructure deficit vs Fields in Trust 0.8ha/1000 standard. Identify park deserts and missing green corridors.' },
  { stageNum: 7,  name: 'Transport & connectivity gaps',           description: 'Pinpointing low PTAL zones, missing active travel links, and disconnected communities.',              focus: 'Low PTAL zones, missing pedestrian and cycle links, disconnected communities, poor bus frequency. Identify access inequality.' },
  { stageNum: 8,  name: 'Economic & employment challenges',        description: 'Identifying employment land loss, vacant commercial premises, and business district decline.',         focus: 'Employment land loss, vacant commercial premises, and business district decline. Identify areas where economic activity has contracted and where policy intervention is needed.' },
  { stageNum: 9,  name: 'Opportunity zone synthesis',             description: 'Cross-referencing all evidence layers to rank highest-priority opportunity zones.',                    focus: 'Synthesise all prior evidence layers. Cross-reference constraint, delivery, and demand data. Rank 2–4 highest-priority opportunity zones with specific spatial boundaries.' },
  { stageNum: 10, name: 'Implementation & delivery proposals',    description: 'Producing concrete spatial interventions per opportunity zone with delivery mechanisms.',              focus: 'Concrete spatial interventions per opportunity zone — specific sites, parks, connections, community infrastructure. Specify delivery mechanism and phasing.' },
]

/** Incremental upsert: write a single stage result into the cached doc */
async function upsertStageResult(
  region: string,
  council: string,
  bounds: [number, number, number, number],
  stageNum: number,
  name: string,
  description: string,
  suggestions: CouncilSuggestion[],
): Promise<void> {
  try {
    const client = await clientPromise
    const db = client.db(process.env.MONGODB_DB ?? 'cityzenith')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const col = db.collection<any>('council_analysis_cache')
    const existing: CachedAnalysis | null = await col.findOne({ _id: region }) as CachedAnalysis | null
    const doc: CachedAnalysis = existing ?? {
      _id: region,
      council,
      bounds,
      stageResults: [],
      updatedAt: new Date(),
    }
    const entry: CachedStageResult = { stageNum, name, description, suggestions }
    const idx = doc.stageResults.findIndex((r) => r.stageNum === stageNum)
    if (idx >= 0) {
      doc.stageResults[idx] = entry
    } else {
      doc.stageResults.push(entry)
    }
    doc.updatedAt = new Date()
    await col.replaceOne({ _id: region }, doc, { upsert: true })
  } catch (err) {
    console.warn(`Failed to upsert stage ${stageNum} to MongoDB cache:`, err)
  }
}

/** Convert a raw Gemini suggestion to a CouncilSuggestion with buffered geometry */
function normaliseSuggestion(
  raw: GeminiSuggestionRaw,
  stage: number,
  index: number,
): CouncilSuggestion {
  const id = `stage${stage}-${index}-${Date.now()}`

  // Buffer the centerPoint to generate an approximate area polygon
  const centerFeature: GeoJSON.Feature<GeoJSON.Point> = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: raw.centerPoint },
    properties: {},
  }
  const radiusKm = (raw.radiusM ?? 200) / 1000
  const buffered = turfBuffer(centerFeature, radiusKm, { units: 'kilometers' })
  const geometry: GeoJSON.Geometry = buffered?.geometry ?? {
    type: 'Polygon',
    coordinates: [[[raw.centerPoint[0], raw.centerPoint[1]], [raw.centerPoint[0] + 0.001, raw.centerPoint[1]], [raw.centerPoint[0], raw.centerPoint[1] + 0.001], [raw.centerPoint[0], raw.centerPoint[1]]]],
  }

  // Normalise implementations — buffer each centerPoint too
  const implementations: ImplementationOption[] = (raw.implementations ?? []).map((impl, i) => {
    const implCenter: GeoJSON.Feature<GeoJSON.Point> = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: impl.centerPoint ?? raw.centerPoint },
      properties: {},
    }
    const implRadius = (impl.radiusM ?? 100) / 1000
    const implBuffered = turfBuffer(implCenter, implRadius, { units: 'kilometers' })
    return {
      type: impl.type as ImplementationOption['type'],
      title: impl.title ?? '',
      description: impl.description ?? '',
      centerPoint: impl.centerPoint ?? raw.centerPoint,
      radiusM: impl.radiusM ?? 100,
      heightM: impl.heightM ?? null,
      color: impl.color ?? [150, 150, 150, 180],
      policyBasis: impl.policyBasis ?? '',
      order: impl.order ?? i + 1,
      projectedEffect: impl.projectedEffect ?? '',
      geometry: implBuffered?.geometry,
    } as unknown as ImplementationOption
  })

  return {
    id,
    stage,
    geometry,
    type: raw.type as CouncilSuggestion['type'],
    status: (raw.status === 'existing' ? 'existing' : 'proposed') as 'existing' | 'proposed',
    title: raw.title ?? 'Untitled',
    rationale: raw.rationale ?? '',
    reasoning: raw.reasoning ?? '',
    priority: raw.priority ?? 'medium',
    evidenceSources: raw.evidenceSources ?? [],
    policyBasis: raw.policyBasis ?? '',
    implementations,
    problem: raw.problem ?? '',
    overallOutcome: raw.overallOutcome ?? '',
    // relatedToTitle is a temp field resolved in post-processing; cast through unknown
    ...((raw.relatedToTitle != null) ? { relatedToTitle: raw.relatedToTitle } : {}),
  } as unknown as CouncilSuggestion
}

/** Send one stage prompt to Gemini and parse the JSON response */
async function runStage(
  stageNum: number,
  focus: string,
  bounds: [number, number, number, number],
  council: string,
  planCorpus: string | null,
  previousSummary: string,
): Promise<GeminiSuggestionRaw[]> {
  const [w, s, e, n] = bounds

  // Retrieve relevant local plan chunks using this stage's focus as the semantic query
  let planContextSection = ''
  if (planCorpus) {
    try {
      const chunks = await Promise.race([
        queryLocalPlan(planCorpus, focus, 4),
        new Promise<PlanChunkResult[]>((resolve) => setTimeout(() => resolve([]), 5000)),
      ])
      if (chunks.length > 0) {
        planContextSection =
          'LOCAL PLAN CONTEXT (relevant policies and supporting text)\n' +
          chunks
            .map((c) => `  [${c.sectionType.toUpperCase()} – ${c.section}, p.${c.pageStart}]\n  ${c.text.slice(0, 600)}`)
            .join('\n\n') +
          '\n\n'
      }
    } catch {
      // Vector search failed — continue without plan context
    }
  }

  const prompt = `You are an AI planning intelligence system supporting ${council} council in England.

Analysis region bounds: West=${w}, South=${s}, East=${e}, North=${n} (WGS84)
This covers the Thamesmead and Greenwich area of South East London.

${planContextSection}${previousSummary ? `Previous analysis stages have identified:\n${previousSummary}\n\n` : ''}

STAGE ${stageNum} FOCUS: ${focus}

Generate only as many suggestions as genuine evidence warrants for this stage. **0 is valid** if nothing significant applies. Do not pad. Typical range 0–5, but let evidence dictate the number. Each suggestion MUST name the problem it solves in the \`problem\` field. Each implementation step is a numbered delivery stage — include \`order\` and a concrete \`projectedEffect\`. Use \`relatedToTitle\` when a suggestion is geographically co-located with or a component of a previously identified suggestion.

Each suggestion must:
- Reference a real area within the bounds above
- Have realistic, precise centerPoint coordinates within [${w},${s}] to [${e},${n}]
- Include specific Local Plan policy references (e.g. "Royal Borough of Greenwich Local Plan Policy H2")
- Provide 3-5 paragraphs of detailed reasoning
- Include 1-3 concrete implementation options where applicable

CITATION RULES — apply in ALL reasoning text and evidenceSources:
- Prefix with (LP PolicyRef) when drawing from the LOCAL PLAN CONTEXT injected above — e.g. "(LP Policy RE1)"
- Prefix with (DP) when drawing from general planning data, statistics, or training knowledge — e.g. "(DP) PTAL 1a rating"
Apply these prefixes inline within sentences, not just at paragraph starts.

Respond ONLY with valid JSON matching this exact schema:
{
  "suggestions": [
    {
      "title": "string — specific area name (e.g. 'South Thamesmead Employment Land')",
      "type": "one of: troubled_area|opportunity_zone|park|housing|bridge|community|mixed_use|transport",
      "status": "existing or proposed — existing = already built/approved/in-place; proposed = recommendation or gap requiring action",
      "rationale": "string — 1-2 sentence summary for map tooltip",
      "reasoning": "string — 3-5 detailed paragraphs with inline (LP PolicyRef) and (DP) citation prefixes",
      "priority": "high|medium|low",
      "centerPoint": [longitude, latitude],
      "radiusM": number,
      "evidenceSources": ["string — each prefixed with (LP PolicyRef) or (DP)"],
      "policyBasis": "string — specific policy reference",
      "problem": "string — 1-2 sentences naming the specific issue or gap at this location",
      "overallOutcome": "string — projected outcome if the full delivery plan is executed, quantified where possible (e.g. '450 new jobs, 3ha unlocked')",
      "relatedToTitle": "string|null — exact title of a previously identified suggestion that this is a close sub-task or geographic sibling of. null if standalone.",
      "implementations": [
        {
          "type": "one of: park|housing|bridge|community|mixed_use|transport",
          "title": "string",
          "description": "string",
          "centerPoint": [longitude, latitude],
          "radiusM": number,
          "heightM": number or null,
          "color": [r, g, b, a],
          "policyBasis": "string",
          "order": 1,
          "projectedEffect": "string — specific projected outcome of completing this step"
        }
      ]
    }
  ]
}`

  const apiKey = process.env.GEMINI_API_KEY ?? ''
  const model  = process.env.GEMINI_MODEL   ?? 'gemini-2.5-pro'
  const url    = `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    }),
    signal: AbortSignal.timeout(90000),
  })

  if (!res.ok) {
    return []
  }

  const data = await res.json()
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'

  try {
    const parsed = JSON.parse(text) as { suggestions?: GeminiSuggestionRaw[] }
    return Array.isArray(parsed.suggestions) ? parsed.suggestions : []
  } catch {
    return []
  }
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: AnalysisRequest
  try {
    body = (await req.json()) as AnalysisRequest
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 })
  }

  const { region, bounds, council, planCorpus, force } = body

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEvent(event, data)))
      }

      try {
        // ── Load cached doc and build per-stage cache map ─────────────────
        let cachedDoc: CachedAnalysis | null = null
        if (!force) {
          try {
            const client = await clientPromise
            const db = client.db(process.env.MONGODB_DB ?? 'cityzenith')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cachedDoc = await (db.collection('council_analysis_cache') as any).findOne({ _id: region }) as CachedAnalysis | null
          } catch (err) {
            console.warn('MongoDB cache check failed, proceeding with live analysis:', err)
          }
        }

        const stageCache = new Map<number, CouncilSuggestion[]>()
        if (cachedDoc?.stageResults) {
          for (const sr of cachedDoc.stageResults) {
            stageCache.set(sr.stageNum, sr.suggestions)
          }
        }

        // ── Run all stages (per-stage cache) ──────────────────────────────
        const allSuggestions: CouncilSuggestion[] = []
        let previousSummary = ''

        for (const stageDef of ANALYSIS_STAGES) {
          const { stageNum, name, description, focus } = stageDef

          const cachedStage = stageCache.get(stageNum)
          const fromCache = !force && cachedStage != null

          send('stage_start', { stageNum, name, description, fromCache })

          let normalisedSuggestions: CouncilSuggestion[]

          if (fromCache) {
            normalisedSuggestions = cachedStage!
          } else {
            const rawSuggestions = await runStage(
              stageNum,
              focus,
              bounds,
              council,
              planCorpus,
              previousSummary,
            )

            normalisedSuggestions = rawSuggestions.map((raw, i) =>
              normaliseSuggestion(raw, stageNum, i),
            )

            // Incremental cache write for this stage
            await upsertStageResult(region, council, bounds, stageNum, name, description, normalisedSuggestions)
          }

          for (const suggestion of normalisedSuggestions) {
            send('suggestion', suggestion)
            allSuggestions.push(suggestion)
          }

          send('stage_complete', {
            stageNum,
            suggestionCount: normalisedSuggestions.length,
          })

          // Update summary for next stage context (only needed for live stages)
          if (!fromCache && normalisedSuggestions.length > 0) {
            previousSummary += normalisedSuggestions
              .map((s) => `- ${s.title} (${s.type}, ${s.priority} priority): ${s.rationale}`)
              .join('\n')
            previousSummary += '\n'
          }

          // Small delay between cached stages to avoid flooding the client
          if (fromCache) {
            await new Promise((resolve) => setTimeout(resolve, 350))
          }
        }

        // ── Post-processing: resolve relatedToTitle → parentId ────────────
        const titleToId = new Map(allSuggestions.map((s) => [s.title.toLowerCase().trim(), s.id]))
        for (const s of allSuggestions) {
          const relatedToTitle = (s as unknown as { relatedToTitle?: string }).relatedToTitle
          if (relatedToTitle) {
            const parentId = titleToId.get(relatedToTitle.toLowerCase().trim())
            if (parentId && parentId !== s.id) {
              s.parentId = parentId
              const parent = allSuggestions.find((p) => p.id === parentId)
              if (parent) {
                s.parentTitle = parent.title
                parent.relatedIds = [...(parent.relatedIds ?? []), s.id]
              }
            }
          }
        }

        send('complete', { totalSuggestions: allSuggestions.length })
        controller.close()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Analysis failed'
        controller.enqueue(encoder.encode(sseEvent('error', { message })))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
