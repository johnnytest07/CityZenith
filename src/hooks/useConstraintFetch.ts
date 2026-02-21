import type { ConstraintType, StatutoryConstraints } from '@/types/constraints'
import { CONSTRAINT_TYPES, emptyConstraints } from '@/types/constraints'
import { bufferGeometry } from '@/lib/geometry'

/**
 * Fetch all 4 statutory constraint types in parallel against the site geometry
 * + 100m buffer. Returns StatutoryConstraints with raw GeoJSON features.
 *
 * This is NOT a React hook — it's a plain async function called by useSiteSelection.
 * This avoids hook ordering issues and makes it easier to test.
 */
export async function fetchConstraintsForSite(
  siteGeometry: GeoJSON.Geometry,
  onProgress?: (type: ConstraintType, result: StatutoryConstraints[ConstraintType]) => void,
): Promise<StatutoryConstraints> {
  // Buffer site by 100m for constraint intersection
  const buffered = bufferGeometry(siteGeometry, 0.1)
  const intersectionGeometry = buffered ? buffered.geometry : siteGeometry

  const result = emptyConstraints()

  // Fetch all 4 types in parallel
  await Promise.allSettled(
    CONSTRAINT_TYPES.map(async (constraintType) => {
      try {
        const res = await fetch('/api/constraints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ constraintType, geometry: intersectionGeometry }),
          signal: AbortSignal.timeout(15000),
        })

        if (!res.ok) {
          result[constraintType] = { intersects: false, features: null, isLoading: false }
          onProgress?.(constraintType, result[constraintType])
          return
        }

        const geojson = await res.json() as GeoJSON.FeatureCollection
        const intersects = geojson.features.length > 0

        result[constraintType] = {
          intersects,
          features: geojson,
          isLoading: false,
        }
        onProgress?.(constraintType, result[constraintType])
      } catch {
        result[constraintType] = { intersects: false, features: null, isLoading: false }
        onProgress?.(constraintType, result[constraintType])
      }
    }),
  )

  return result
}
