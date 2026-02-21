/**
 * POST /api/market-value
 *
 * Body: { bounds: [west, south, east, north] }
 *
 * Returns:
 *   { hexGrid: GeoJSON.FeatureCollection, boroughMedian: number, txCount: number }
 *
 * Pipeline:
 *   1. postcodes.io → outward codes for viewport centre
 *   2. HMLR SPARQL → residential transactions last 5yr
 *   3. postcodes.io bulk → postcode → [lng, lat]
 *   4. turf.hexGrid aggregation with relative scores
 */

import { NextRequest, NextResponse } from 'next/server'
import { getViewportOutcodes, geocodePostcodes } from '@/lib/pricePaid/geo'
import { fetchTransactions } from '@/lib/pricePaid/ingest'
import { buildHexGrid, median } from '@/lib/pricePaid/aggregate'
import * as turf from '@turf/turf'

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  const bounds = b.bounds

  if (
    !Array.isArray(bounds) ||
    bounds.length !== 4 ||
    bounds.some((v) => typeof v !== 'number')
  ) {
    return NextResponse.json(
      { error: 'bounds must be a 4-element number array [west, south, east, north]' },
      { status: 400 },
    )
  }

  const [west, south, east, north] = bounds as [number, number, number, number]
  const cx = (west + east) / 2
  const cy = (south + north) / 2

  // 1. Get outward codes for the viewport centre (3km radius)
  const outcodes = await getViewportOutcodes(cx, cy, 3000)
  if (outcodes.length === 0) {
    return NextResponse.json({ hexGrid: EMPTY_FC, boroughMedian: 0, txCount: 0 })
  }

  // 2. Fetch HMLR transactions (30s timeout)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  let transactions
  try {
    transactions = await fetchTransactions(outcodes, controller.signal)
  } catch {
    return NextResponse.json(
      { error: 'HMLR data fetch failed' },
      { status: 502 },
    )
  } finally {
    clearTimeout(timeout)
  }

  if (transactions.length === 0) {
    return NextResponse.json({ hexGrid: EMPTY_FC, boroughMedian: 0, txCount: 0 })
  }

  // 3. Geocode unique postcodes
  const uniquePostcodes = [...new Set(transactions.map((t) => t.postcode))]
  const coordsMap = await geocodePostcodes(uniquePostcodes)

  // 4. Borough-level median (all transactions)
  const allPrices = transactions.map((t) => t.price)
  const boroughMedian = median(allPrices)

  // 5. Build hex grid — clip bounds to the actual data extent for efficiency
  const bboxBounds: [number, number, number, number] = [west, south, east, north]

  const hexGrid = buildHexGrid(transactions, coordsMap, boroughMedian, bboxBounds)

  return NextResponse.json({
    hexGrid,
    boroughMedian,
    txCount: transactions.length,
  })
}
