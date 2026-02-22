import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongoClient'
import {
  buildOverpassQuery,
  processOverpassElements,
  enrichWithRoadDistances,
  OVERPASS_MIRRORS,
  type OverpassElement,
} from '@/lib/amenities'
import type { NearbyAmenity } from '@/types/amenities'

/** Round to nearest 0.01° for geo-bucket cache key. */
function geoBucket(lat: number, lng: number): string {
  const bLat = Math.round(lat / 0.01) * 0.01
  const bLng = Math.round(lng / 0.01) * 0.01
  return `${bLat.toFixed(2)}_${bLng.toFixed(2)}`
}

async function getCached(key: string): Promise<NearbyAmenity[] | null> {
  try {
    const db = (await clientPromise).db(process.env.MONGODB_DB ?? 'cityzenith')
    const doc = await db.collection('amenities_cache').findOne({ _id: key as any })
    return (doc?.amenities as NearbyAmenity[]) ?? null
  } catch { return null }
}

async function setCache(key: string, amenities: NearbyAmenity[]): Promise<void> {
  try {
    const db = (await clientPromise).db(process.env.MONGODB_DB ?? 'cityzenith')
    await db.collection('amenities_cache').replaceOne(
      { _id: key as any },
      { _id: key, amenities, cachedAt: new Date() },
      { upsert: true },
    )
  } catch { /* non-fatal */ }
}

/** Try each Overpass mirror in order, returning on first 200. */
async function fetchFromOverpass(query: string): Promise<OverpassElement[]> {
  let lastError: Error | null = null
  for (const url of OVERPASS_MIRRORS) {
    try {
      console.log(`[/api/amenities] trying Overpass mirror: ${url}`)
      const res = await fetch(url, {
        method: 'POST',
        body: query,
        headers: { 'Content-Type': 'text/plain' },
        signal: AbortSignal.timeout(20_000),
      })
      if (res.status === 429) {
        console.warn(`[/api/amenities] ${url} → 429, trying next mirror`)
        lastError = new Error(`429 from ${url}`)
        continue
      }
      if (!res.ok) throw new Error(`Overpass ${res.status} from ${url}`)
      const data = await res.json() as { elements: OverpassElement[] }
      console.log(`[/api/amenities] ${url} → ${data.elements.length} elements`)
      return data.elements
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`[/api/amenities] mirror failed: ${lastError.message}`)
    }
  }
  throw lastError ?? new Error('All Overpass mirrors failed')
}

export async function POST(request: NextRequest) {
  let lat: number, lng: number
  try {
    const body = await request.json() as { lat?: number; lng?: number }
    if (typeof body.lat !== 'number' || typeof body.lng !== 'number') {
      return NextResponse.json({ error: 'lat and lng required' }, { status: 400 })
    }
    lat = body.lat
    lng = body.lng
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const cacheKey = geoBucket(lat, lng)

  // ── Cache check ──────────────────────────────────────────────────────────────
  const cached = await getCached(cacheKey)
  if (cached) {
    console.log(`[/api/amenities] cache hit for bucket ${cacheKey} (${cached.length} amenities)`)
    return NextResponse.json({ amenities: cached, fromCache: true })
  }

  // ── Fetch from Overpass (server-side, higher rate limit, mirror fallback) ────
  try {
    const query = buildOverpassQuery(lat, lng)
    const elements = await fetchFromOverpass(query)
    const processed = processOverpassElements(elements, lat, lng)
    const enriched = await enrichWithRoadDistances([lng, lat], processed)

    await setCache(cacheKey, enriched)
    console.log(`[/api/amenities] cached ${enriched.length} amenities for bucket ${cacheKey}`)

    return NextResponse.json({ amenities: enriched })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[/api/amenities] failed:`, message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
