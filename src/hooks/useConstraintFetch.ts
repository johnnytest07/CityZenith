import type { ConstraintType, StatutoryConstraints } from '@/types/constraints'
import { CONSTRAINT_TYPES, emptyConstraints } from '@/types/constraints'

/**
 * Fetch all 4 statutory constraint types in parallel.
 *
 * The caller is responsible for providing a pre-prepared constraintGeometry
 * (typically a simple circle around the site centroid). This avoids running
 * turf.buffer on complex building footprint polygons on the main thread, which
 * was the primary cause of UI freezes when clicking on buildings.
 *
 * The server-side route extracts a bounding box from the geometry, so a simple
 * circle is functionally equivalent to a buffered footprint for this purpose.
 */
export async function fetchConstraintsForSite(
  constraintGeometry: GeoJSON.Geometry,
  signal?: AbortSignal,
): Promise<StatutoryConstraints> {
  const result = emptyConstraints()

  await Promise.allSettled(
    CONSTRAINT_TYPES.map(async (constraintType) => {
      try {
        const res = await fetch('/api/constraints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ constraintType, geometry: constraintGeometry }),
          signal,
        })

        if (!res.ok) {
          result[constraintType] = { intersects: false, features: null, isLoading: false }
          return
        }

        const geojson = await res.json() as GeoJSON.FeatureCollection
        result[constraintType] = {
          intersects: geojson.features.length > 0,
          features: geojson,
          isLoading: false,
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        result[constraintType] = { intersects: false, features: null, isLoading: false }
      }
    }),
  )

  return result
}
