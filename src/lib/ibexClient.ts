import type { PolygonSearchRequest, StatsRequest, PlanningApplication, PlanningContextStats } from '@/types/ibex'

/**
 * POST to the server-side Ibex search proxy.
 * Returns raw PlanningApplication array.
 */
export async function searchByPolygon(params: PolygonSearchRequest): Promise<PlanningApplication[]> {
  const res = await fetch('/api/ibex/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`IBEX search failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  // Handle both { results: [...] } and flat array responses
  return Array.isArray(data) ? data : (data.results ?? data.data ?? [])
}

/**
 * POST to the server-side Ibex stats proxy.
 * Returns PlanningContextStats as-is from IBEX.
 */
export async function getStats(params: StatsRequest): Promise<PlanningContextStats> {
  const res = await fetch('/api/ibex/stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`IBEX stats failed (${res.status}): ${text}`)
  }

  return res.json()
}
