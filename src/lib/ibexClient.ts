import type { SearchRequest, StatsRequest, PlanningApplication, PlanningContextStats } from '@/types/ibex'

/**
 * POST to the server-side IBEX search proxy.
 * Sends polygon coordinates (EPSG:27700) using the correct SearchRequestSchema format.
 * Accepts an AbortSignal to cancel the request when the user selects a new site.
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
      num_new_houses: true,
    },
    filters: {},
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
 * Requires a council_id (numeric) extracted from search results.
 * Returns PlanningContextStats as-is from IBEX.
 * Accepts an AbortSignal to cancel the request when the user selects a new site.
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
