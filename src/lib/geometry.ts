import * as turf from '@turf/turf'

/**
 * Create a 100m (default) circle polygon around a WGS84 click point.
 * Used as fallback site geometry when no polygon is clicked.
 */
export function bufferClickPoint(
  lngLat: [number, number],
  radiusKm: number = 0.1,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const pt = turf.point(lngLat)
  return turf.circle(pt, radiusKm, { units: 'kilometers', steps: 64 })
}

/**
 * Buffer a GeoJSON geometry by radiusKm.
 * Used to create the constraint intersection area (site + 100m buffer).
 */
export function bufferGeometry(
  geometry: GeoJSON.Geometry,
  radiusKm: number,
): GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null {
  const feature = turf.feature(geometry)
  const buffered = turf.buffer(feature, radiusKm, { units: 'kilometers' })
  return buffered ?? null
}

/**
 * Create a 50m circle polygon around a WGS84 centroid.
 * Used during planning application normalisation when no geometry is available.
 */
export function bufferCentroid(
  lngLat: [number, number],
  radiusKm: number = 0.05,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const pt = turf.point(lngLat)
  return turf.circle(pt, radiusKm, { units: 'kilometers', steps: 32 })
}

/**
 * Returns the centroid [lng, lat] of a geometry.
 */
export function getCentroid(geometry: GeoJSON.Geometry): [number, number] {
  const feature = turf.feature(geometry)
  const c = turf.centroid(feature)
  return c.geometry.coordinates as [number, number]
}
