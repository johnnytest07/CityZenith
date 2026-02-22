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
 *   2. HMLR SPARQL → residential transactions last 2yr  (cached 1hr per outcode set)
 *   3. postcodes.io bulk → postcode → [lng, lat]        (cached with transactions)
 *   4. turf.hexGrid aggregation with relative scores    (recomputed per bounds)
 *
 * HMLR SPARQL is slow (~15-20s for a 4-outcode query). The in-process cache means
 * the first request for a given area is slow; every subsequent toggle/pan is instant.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getViewportOutcodes, geocodePostcodes } from '@/lib/pricePaid/geo'
import { fetchTransactions, type RawTransaction } from '@/lib/pricePaid/ingest'
import { buildHexGrid, median } from '@/lib/pricePaid/aggregate'

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

interface CacheEntry {
  transactions: RawTransaction[]
  coordsMap: Map<string, [number, number]>
  cachedAt: number
}

// Module-level cache — persists across requests within the same server process.
const txCache = new Map<string, CacheEntry>()

function cacheKey(outcodes: string[]): string {
  return [...outcodes].sort().join('|')
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
  console.log('[market-value] outcodes:', outcodes)
  if (outcodes.length === 0) {
    console.log('[market-value] no outcodes found — returning empty')
    return NextResponse.json({ hexGrid: EMPTY_FC, boroughMedian: 0, txCount: 0 })
  }

  const key = cacheKey(outcodes)
  const cached = txCache.get(key)
  const now = Date.now()

  let transactions: RawTransaction[]
  let coordsMap: Map<string, [number, number]>

  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    console.log('[market-value] cache hit —', cached.transactions.length, 'transactions')
    transactions = cached.transactions
    coordsMap = cached.coordsMap
  } else {
    // 2. Fetch HMLR transactions in parallel — one request per outcode (~13s each)
    transactions = await fetchTransactions(outcodes)
    console.log('[market-value] transactions fetched:', transactions.length)

    if (transactions.length === 0) {
      console.log('[market-value] no transactions — returning empty')
      return NextResponse.json({ hexGrid: EMPTY_FC, boroughMedian: 0, txCount: 0 })
    }

    // 3. Geocode unique postcodes
    const uniquePostcodes = [...new Set(transactions.map((t) => t.postcode))]
    coordsMap = await geocodePostcodes(uniquePostcodes)
    console.log('[market-value] geocoded', coordsMap.size, '/', uniquePostcodes.length, 'postcodes')

    txCache.set(key, { transactions, coordsMap, cachedAt: now })
  }

  if (transactions.length === 0) {
    return NextResponse.json({ hexGrid: EMPTY_FC, boroughMedian: 0, txCount: 0 })
  }

  // 4. Borough-level median
  const allPrices = transactions.map((t) => t.price)
  const boroughMedian = median(allPrices)

  // 5. Build hex grid for current viewport bounds
  const hexGrid = buildHexGrid(transactions, coordsMap, boroughMedian, [west, south, east, north])
  const populatedHexes = hexGrid.features.filter((f) => f.properties?.relativeScore != null).length
  console.log('[market-value] hex grid:', hexGrid.features.length, 'cells,', populatedHexes, 'populated')

  return NextResponse.json({ hexGrid, boroughMedian, txCount: transactions.length })
}
