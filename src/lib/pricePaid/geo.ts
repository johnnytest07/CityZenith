/**
 * postcodes.io helpers for the market-value pipeline.
 *
 * getViewportOutcodes  — look up outward codes (e.g. "SE28") covering a viewport centre
 * geocodePostcodes     — bulk-geocode a list of full postcodes to [lng, lat]
 */

interface OutcodeResult {
  outcode: string
}

interface PostcodesIoOutcodesResponse {
  status: number
  result: OutcodeResult[] | null
}

interface PostcodeResult {
  postcode: string
  longitude: number | null
  latitude: number | null
}

interface PostcodesIoBulkResponse {
  status: number
  result: Array<{ query: string; result: PostcodeResult | null }> | null
}

/**
 * Return outward codes (e.g. ["SE28", "SE2", "DA18"]) that cover the given
 * map centre within `radiusM` metres.  Returns [] on error or empty result.
 */
export async function getViewportOutcodes(
  lng: number,
  lat: number,
  radiusM: number,
): Promise<string[]> {
  try {
    const url = `https://api.postcodes.io/outcodes?lon=${lng}&lat=${lat}&radius=${radiusM}&limit=20`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const data = (await res.json()) as PostcodesIoOutcodesResponse
    if (!data.result || data.result.length === 0) return []
    return data.result.map((r) => r.outcode)
  } catch {
    return []
  }
}

/**
 * Bulk-geocode an array of full postcodes to [lng, lat] pairs.
 * Batches into groups of 100 (postcodes.io limit).
 * Skips null / terminated results.
 */
export async function geocodePostcodes(
  postcodes: string[],
): Promise<Map<string, [number, number]>> {
  const result = new Map<string, [number, number]>()
  if (postcodes.length === 0) return result

  // Batch into groups of 100
  const batches: string[][] = []
  for (let i = 0; i < postcodes.length; i += 100) {
    batches.push(postcodes.slice(i, i + 100))
  }

  await Promise.all(
    batches.map(async (batch) => {
      try {
        const res = await fetch('https://api.postcodes.io/postcodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postcodes: batch }),
        })
        if (!res.ok) return
        const data = (await res.json()) as PostcodesIoBulkResponse
        if (!data.result) return
        for (const item of data.result) {
          if (
            item.result &&
            item.result.longitude !== null &&
            item.result.latitude !== null
          ) {
            result.set(item.query, [item.result.longitude, item.result.latitude])
          }
        }
      } catch {
        // skip failed batch
      }
    }),
  )

  return result
}
