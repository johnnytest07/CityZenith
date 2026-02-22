import type {
  SearchRequest,
  StatsRequest,
  ApplicationsRequest,
  PlanningApplication,
  PlanningContextStats,
  CouncilPipeline,
  CouncilPipelineItem,
} from '@/types/ibex'

/** Councils we have full pipeline data enabled for. */
const PIPELINE_COUNCIL_IDS = new Set([25, 24]) // Royal Greenwich, Enfield

/**
 * POST to the server-side IBEX search proxy.
 * Requests all available extensions for the richest possible feature set.
 */
export async function searchByPolygon(
  polygon27700: number[][],
  signal?: AbortSignal,
): Promise<PlanningApplication[]> {
  const body: SearchRequest = {
    input: {
      srid: 27700,
      polygon: {
        geometry: {
          type: 'Polygon',
          coordinates: [polygon27700],
        },
      },
    },
    extensions: {
      appeals: true,
      centre_point: true,
      heading: true,
      project_type: true,
      num_new_houses: true,
      num_comments_received: true,
      proposed_unit_mix: true,
      proposed_floor_area: true,
      document_metadata: true,
    },
    filters: {
      // Exclude minor householder applications (rear extensions, loft conversions, etc.)
      // to focus planning precedent on substantive, precedent-setting developments only.
      normalised_application_type: [
        'full planning application',
        'change of use',
        'listed building consent',
        'conservation area',
        'lawful development',
        'discharge of conditions',
        'environmental impact',
        'section 106',
      ],
    },
  }

  const res = await fetch('/api/ibex/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`IBEX search failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return Array.isArray(data) ? data : (data.results ?? data.data ?? [])
}

/**
 * POST to the server-side IBEX stats proxy.
 * Returns 5-year council-level stats.
 */
export async function getStats(
  councilId: number,
  signal?: AbortSignal,
): Promise<PlanningContextStats> {
  const today = new Date().toISOString().slice(0, 10)
  const fiveYearsAgo = new Date(Date.now() - 5 * 365.25 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const body: StatsRequest = {
    input: {
      council_id: councilId,
      date_from: fiveYearsAgo,
      date_to: today,
    },
  }

  const res = await fetch('/api/ibex/stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`IBEX stats failed (${res.status}): ${text}`)
  }

  return res.json()
}

/**
 * Returns true if we support full pipeline fetching for this council.
 * Prevents unnecessary API calls for councils we don't have data for.
 */
export function isPipelineCouncil(councilId: number): boolean {
  return PIPELINE_COUNCIL_IDS.has(councilId)
}

/**
 * Fetch council-wide approved residential pipeline via IBEX /applications.
 * Only called for supported councils (Royal Greenwich, Enfield).
 * Returns approved schemes with ≥1 new home decided in the last 2 years.
 */
export async function fetchCouncilPipeline(
  councilId: number,
  signal?: AbortSignal,
): Promise<CouncilPipeline> {
  const today = new Date().toISOString().slice(0, 10)
  const twoYearsAgo = new Date(Date.now() - 2 * 365.25 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const body: ApplicationsRequest = {
    input: {
      council_id: [councilId],
      date_from: twoYearsAgo,
      date_to: today,
      date_range_type: 'decided',
      page_size: 500,
    },
    extensions: {
      project_type: true,
      heading: true,
      num_new_houses: true,
      proposed_unit_mix: true,
      proposed_floor_area: true,
    },
    filters: {
      normalised_decision: ['Approved'],
      num_new_houses: { min: 1 },
    },
  }

  const res = await fetch('/api/ibex/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`IBEX applications failed (${res.status}): ${text}`)
  }

  const raw = await res.json()
  const apps: PlanningApplication[] = Array.isArray(raw) ? raw : []

  const applications: CouncilPipelineItem[] = apps.map((a) => ({
    planning_reference: a.planning_reference,
    heading: a.heading ?? null,
    proposal: a.proposal,
    decided_date: a.decided_date,
    project_type: a.project_type ?? null,
    num_new_houses: a.num_new_houses ?? null,
    proposed_unit_mix: a.proposed_unit_mix ?? null,
    proposed_floor_area: a.proposed_floor_area ?? null,
  }))

  return {
    councilId,
    councilName: apps[0]?.council_name ?? 'Unknown Council',
    fetchedAt: new Date().toISOString(),
    applications,
  }
}
