/**
 * Aggregates raw HMLR transactions onto a turf.js hex grid.
 *
 * Each hex cell with ≥3 transactions gets:
 *   relativeScore  — (medianPrice − boroughMedian) / boroughMedian, clamped ±1
 *   medianPrice    — median price within the hex
 *   txCount        — number of transactions
 *   growth1yr      — median last 12m vs 12–24m ago (null if insufficient data)
 *   growth3yr      — median last 12m vs 36–48m ago (null if insufficient data)
 */

import * as turf from '@turf/turf'
import type { RawTransaction } from './ingest'

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

/** ms timestamp for N months ago */
function monthsAgo(n: number): number {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d.getTime()
}

/**
 * Compute relative growth between two price arrays.
 * Returns null when either window has fewer than 2 transactions.
 */
function growthRate(
  recent: number[],
  earlier: number[],
): number | null {
  if (recent.length < 2 || earlier.length < 2) return null
  const recentMedian = median(recent)
  const earlierMedian = median(earlier)
  if (earlierMedian === 0) return null
  return (recentMedian - earlierMedian) / earlierMedian
}

export function buildHexGrid(
  transactions: RawTransaction[],
  coordsMap: Map<string, [number, number]>,
  boroughMedian: number,
  bounds: [number, number, number, number],
): GeoJSON.FeatureCollection {
  // Build GeoJSON point collection from geocoded transactions
  const points = turf.featureCollection(
    transactions
      .filter((tx) => coordsMap.has(tx.postcode))
      .map((tx) => {
        const [lng, lat] = coordsMap.get(tx.postcode)!
        return turf.point([lng, lat], { price: tx.price, date: tx.date })
      }),
  )

  // Generate hex grid (~250m cells)
  const hexGrid = turf.hexGrid(bounds, 0.25, { units: 'kilometers' })

  // Pre-compute time windows
  const now = Date.now()
  const t12 = monthsAgo(12)
  const t24 = monthsAgo(24)
  const t36 = monthsAgo(36)
  const t48 = monthsAgo(48)

  const outputFeatures: GeoJSON.Feature[] = []

  for (const hex of hexGrid.features) {
    const inside = turf.pointsWithinPolygon(points, hex)
    const txCount = inside.features.length

    if (txCount < 3) {
      // Not enough data — omit this cell (layer treats missing properties as no-data)
      outputFeatures.push(hex)
      continue
    }

    const prices = inside.features.map(
      (f) => (f.properties as { price: number }).price,
    )
    const dates = inside.features.map((f) =>
      new Date((f.properties as { date: string }).date).getTime(),
    )

    const medianPrice = median(prices)
    const rawScore =
      boroughMedian > 0 ? (medianPrice - boroughMedian) / boroughMedian : 0
    const relativeScore = Math.max(-1, Math.min(1, rawScore))

    // Growth rates
    const recentPrices = prices.filter((_, i) => dates[i] >= t12)
    const prev1yr = prices.filter((_, i) => dates[i] >= t24 && dates[i] < t12)
    const prev3yr = prices.filter((_, i) => dates[i] >= t48 && dates[i] < t36)

    const growth1yr = growthRate(recentPrices, prev1yr)
    const growth3yr = growthRate(recentPrices, prev3yr)

    const props: Record<string, number | null> = {
      relativeScore,
      medianPrice,
      txCount,
      growth1yr: growth1yr ?? null,
      growth3yr: growth3yr ?? null,
    }

    outputFeatures.push({
      ...hex,
      properties: props,
    })
  }

  return turf.featureCollection(outputFeatures)
}
