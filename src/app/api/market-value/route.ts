/**
 * POST /api/market-value
 *
 * Body: { bounds: [west, south, east, north], knownOutcodes?: string[] }
 *
 * Returns raw transaction + coord data for NEW outcodes only.
 * The client accumulates this data and builds the hex grid locally,
 * so zoom changes are instant (no refetch needed) and panning adds
 * to existing data without resetting the layer.
 *
 * Returns:
 *   { transactions: RawTransaction[], coordsMap: Record<string,[number,number]>, newOutcodes: string[] }
 *
 * If all viewport outcodes are already known (knownOutcodes covers them all),
 * returns empty arrays — the client rebuilds the hex grid from its cache.
 *
 * HMLR SPARQL cache: 1hr per outcode set, module-level.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getViewportBoundsOutcodes, geocodePostcodes } from '@/lib/pricePaid/geo'
import { fetchTransactions, type RawTransaction } from '@/lib/pricePaid/ingest'

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
  const knownOutcodes: string[] = Array.isArray(b.knownOutcodes)
    ? (b.knownOutcodes as string[])
    : []

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

  // 1. Get all outcodes visible in viewport (centre + all 4 corners)
  const allOutcodes = await getViewportBoundsOutcodes(west, south, east, north)
  console.log('[market-value] viewport outcodes:', allOutcodes)

  if (allOutcodes.length === 0) {
    return NextResponse.json({ transactions: [], coordsMap: {}, newOutcodes: [] })
  }

  // 2. Only fetch outcodes not already known to the client
  const knownSet = new Set(knownOutcodes)
  const newOutcodes = allOutcodes.filter((oc) => !knownSet.has(oc))
  console.log('[market-value] new outcodes to fetch:', newOutcodes)

  if (newOutcodes.length === 0) {
    // Client already has all data — it will rebuild hex grid locally
    return NextResponse.json({ transactions: [], coordsMap: {}, newOutcodes: [] })
  }

  const key = cacheKey(newOutcodes)
  const cached = txCache.get(key)
  const now = Date.now()

  let transactions: RawTransaction[]
  let coordsMap: Map<string, [number, number]>

  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    console.log('[market-value] cache hit —', cached.transactions.length, 'transactions')
    transactions = cached.transactions
    coordsMap = cached.coordsMap
  } else {
    // 3. Fetch HMLR transactions in parallel — one request per outcode
    transactions = await fetchTransactions(newOutcodes)
    console.log('[market-value] transactions fetched:', transactions.length)

    if (transactions.length === 0) {
      // Mark as loaded (avoid re-querying empty outcodes)
      txCache.set(key, { transactions: [], coordsMap: new Map(), cachedAt: now })
      return NextResponse.json({ transactions: [], coordsMap: {}, newOutcodes })
    }

    // 4. Geocode unique postcodes
    const uniquePostcodes = [...new Set(transactions.map((t) => t.postcode))]
    coordsMap = await geocodePostcodes(uniquePostcodes)
    console.log('[market-value] geocoded', coordsMap.size, '/', uniquePostcodes.length, 'postcodes')

    txCache.set(key, { transactions, coordsMap, cachedAt: now })
  }

  // Serialize coordsMap to plain object for JSON transport
  const coordsObj: Record<string, [number, number]> = {}
  for (const [k, v] of coordsMap) coordsObj[k] = v

  return NextResponse.json({ transactions, coordsMap: coordsObj, newOutcodes })
}
