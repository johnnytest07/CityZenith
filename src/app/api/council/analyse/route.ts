import { NextRequest } from 'next/server'
import clientPromise from '@/lib/mongoClient'
import { buffer as turfBuffer } from '@turf/turf'
import type { CouncilSuggestion, AnalysisStage, ImplementationOption } from '@/types/council'

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
  rationale: string
  reasoning: string
  priority: 'high' | 'medium' | 'low'
  centerPoint: [number, number]
  radiusM: number
  evidenceSources: string[]
  policyBasis: string
  implementations: Array<{
    type: string
    title: string
    description: string
    centerPoint: [number, number]
    radiusM: number
    heightM: number | null
    color: [number, number, number, number]
    policyBasis: string
  }>
}

interface CachedAnalysis {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _id: any
  council: string
  bounds: [number, number, number, number]
  stages: AnalysisStage[]
  suggestions: CouncilSuggestion[]
  cachedAt: Date
}

const ANALYSIS_STAGES: Array<{ stageNum: number; name: string; description: string; focus: string }> = [
  { stageNum: 1,  name: 'Mapping land use and vacancy patterns',              description: 'Identifying underutilised and vacant parcels across the region.', focus: 'Land use vacancy and underutilisation patterns. Identify areas with industrial decline, vacant sites, or brownfield potential.' },
  { stageNum: 2,  name: 'Identifying constraint-burdened low-delivery zones',  description: 'Locating areas with overlapping statutory constraints limiting development.', focus: 'Statutory planning constraints (Green Belt, Conservation Areas, Flood Risk, Article 4). Identify zones where constraints are blocking potential regeneration.' },
  { stageNum: 3,  name: 'Analysing planning refusal clusters and stalled sites', description: 'Detecting patterns in refused applications and sites with repeated failures.', focus: 'Planning application refusal patterns. Identify areas with repeated refusals, stalled sites, and systemic delivery failure.' },
  { stageNum: 4,  name: 'Querying local plan regeneration policies',           description: 'Extracting opportunity area and regeneration zone designations from the adopted plan.', focus: 'Local plan regeneration policies, opportunity areas, and strategic development allocations. Focus on policy RE1, SH1, and equivalent regeneration designations.' },
  { stageNum: 5,  name: 'Assessing residential delivery gap vs housing targets', description: 'Comparing approved pipeline to the 5-year housing land supply target.', focus: 'Housing delivery gap. Compare approved residential pipeline to 5-year housing land supply targets. Identify areas where new housing is critically needed.' },
  { stageNum: 6,  name: 'Evaluating green infrastructure and open space deficit', description: 'Measuring open space provision against national and local accessibility standards.', focus: 'Open space deficit. Identify areas lacking parks, green corridors, and accessible green infrastructure per the Fields in Trust standard (0.8ha/1000 population).' },
  { stageNum: 7,  name: 'Identifying transport and connectivity gaps',          description: 'Pinpointing areas with poor public transport access and missing active travel links.', focus: 'Transport connectivity gaps. Identify areas with poor PTAL ratings, missing pedestrian/cycle links, and disconnected communities.' },
  { stageNum: 8,  name: 'Synthesising and ranking opportunity zones',          description: 'Cross-referencing all evidence layers to score and prioritise opportunity zones.', focus: 'Synthesise all previous analysis. Rank opportunity zones by impact, deliverability, and policy support. Produce 2-4 high-priority zone identifications.' },
  { stageNum: 9,  name: 'Generating implementation proposals per zone',        description: 'Producing concrete spatial interventions for each ranked opportunity.', focus: 'Concrete implementation proposals (parks, housing schemes, bridges, community facilities). Each proposal must have precise coordinates within Thamesmead/Greenwich bounds.' },
  { stageNum: 10, name: 'Producing policy-backed executive summary',           description: 'Synthesising findings into an officer-ready summary with Local Plan citations.', focus: 'Executive summary integrating all findings. Cite specific Local Plan policies for each recommendation. Officer-ready language.' },
]

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
  const implementations: ImplementationOption[] = (raw.implementations ?? []).map((impl) => {
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
      geometry: implBuffered?.geometry,
    } as unknown as ImplementationOption
  })

  return {
    id,
    stage,
    geometry,
    type: raw.type as CouncilSuggestion['type'],
    title: raw.title ?? 'Untitled',
    rationale: raw.rationale ?? '',
    reasoning: raw.reasoning ?? '',
    priority: raw.priority ?? 'medium',
    evidenceSources: raw.evidenceSources ?? [],
    policyBasis: raw.policyBasis ?? '',
    implementations,
  }
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
  const prompt = `You are an AI planning intelligence system supporting ${council} council in England.

Analysis region bounds: West=${w}, South=${s}, East=${e}, North=${n} (WGS84)
This covers the Thamesmead and Greenwich area of South East London.

${planCorpus ? `Local Plan context:\n${planCorpus.slice(0, 2000)}\n\n` : ''}

${previousSummary ? `Previous analysis stages have identified:\n${previousSummary}\n\n` : ''}

STAGE ${stageNum} FOCUS: ${focus}

Generate 0-4 specific, spatially grounded suggestions for this stage. Each suggestion must:
- Reference a real area within the bounds above
- Have realistic, precise centerPoint coordinates within [${w},${s}] to [${e},${n}]
- Include specific Local Plan policy references (e.g. "Royal Borough of Greenwich Local Plan Policy H2")
- Provide 3-5 paragraphs of detailed reasoning
- Include 1-3 concrete implementation options where applicable

Respond ONLY with valid JSON matching this exact schema:
{
  "suggestions": [
    {
      "title": "string — specific area name (e.g. 'South Thamesmead Employment Land')",
      "type": "one of: troubled_area|opportunity_zone|park|housing|bridge|community|mixed_use|transport",
      "rationale": "string — 1-2 sentence summary for map tooltip",
      "reasoning": "string — 3-5 detailed paragraphs",
      "priority": "high|medium|low",
      "centerPoint": [longitude, latitude],
      "radiusM": number,
      "evidenceSources": ["string"],
      "policyBasis": "string — specific policy reference",
      "implementations": [
        {
          "type": "one of: park|housing|bridge|community|mixed_use|transport",
          "title": "string",
          "description": "string",
          "centerPoint": [longitude, latitude],
          "radiusM": number,
          "heightM": number or null,
          "color": [r, g, b, a],
          "policyBasis": "string"
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
        // ── Check MongoDB cache ───────────────────────────────────────────
        let cached: CachedAnalysis | null = null
        if (!force) {
          try {
            const client = await clientPromise
            const db = client.db(process.env.MONGODB_DB ?? 'cityzenith')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cached = await (db.collection('council_analysis_cache') as any).findOne({ _id: region }) as CachedAnalysis | null
          } catch (err) {
            console.warn('MongoDB cache check failed, proceeding with live analysis:', err)
          }
        }

        if (cached) {
          // ── Cache hit: replay with 350ms delays ───────────────────────
          for (const stage of cached.stages) {
            send('stage_start', {
              stageNum: stage.stageNum,
              name: stage.name,
              description: stage.description,
            })

            const stageSuggestions = cached.suggestions.filter((s) => s.stage === stage.stageNum)
            for (const suggestion of stageSuggestions) {
              send('suggestion', suggestion)
            }

            send('stage_complete', {
              stageNum: stage.stageNum,
              suggestionCount: stageSuggestions.length,
            })

            await new Promise((resolve) => setTimeout(resolve, 350))
          }

          send('complete', { totalSuggestions: cached.suggestions.length })
          controller.close()
          return
        }

        // ── Cache miss: run live Gemini pipeline ──────────────────────────
        const allStages: AnalysisStage[] = []
        const allSuggestions: CouncilSuggestion[] = []
        let previousSummary = ''

        for (const stageDef of ANALYSIS_STAGES) {
          const { stageNum, name, description, focus } = stageDef

          send('stage_start', { stageNum, name, description })

          const rawSuggestions = await runStage(
            stageNum,
            focus,
            bounds,
            council,
            planCorpus,
            previousSummary,
          )

          const normalisedSuggestions = rawSuggestions.map((raw, i) =>
            normaliseSuggestion(raw, stageNum, i),
          )

          for (const suggestion of normalisedSuggestions) {
            send('suggestion', suggestion)
            allSuggestions.push(suggestion)
          }

          const stage: AnalysisStage = {
            stageNum,
            name,
            description,
            status: 'complete',
            suggestionCount: normalisedSuggestions.length,
          }
          allStages.push(stage)

          send('stage_complete', {
            stageNum,
            suggestionCount: normalisedSuggestions.length,
          })

          // Update summary for next stage context
          if (normalisedSuggestions.length > 0) {
            previousSummary += normalisedSuggestions
              .map((s) => `- ${s.title} (${s.type}, ${s.priority} priority): ${s.rationale}`)
              .join('\n')
            previousSummary += '\n'
          }
        }

        // ── Write to MongoDB cache ────────────────────────────────────────
        try {
          const client = await clientPromise
          const db = client.db(process.env.MONGODB_DB ?? 'cityzenith')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (db.collection('council_analysis_cache') as any).replaceOne(
            { _id: region },
            {
              _id: region,
              council,
              bounds,
              stages: allStages,
              suggestions: allSuggestions,
              cachedAt: new Date(),
            },
            { upsert: true },
          )
        } catch (err) {
          console.warn('Failed to write analysis to MongoDB cache:', err)
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
