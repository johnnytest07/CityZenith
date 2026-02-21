import { booleanPointInPolygon, point } from '@turf/turf'
import type { Map as MapLibreMap } from 'maplibre-gl'

/**
 * Returns true if the given point is inside any building polygon in the collection.
 */
export function isOnExistingBuilding(
  pt: [number, number],
  buildings: GeoJSON.FeatureCollection,
): boolean {
  const turfPoint = point(pt)
  for (const feature of buildings.features) {
    if (
      feature.geometry.type === 'Polygon' ||
      feature.geometry.type === 'MultiPolygon'
    ) {
      try {
        if (booleanPointInPolygon(turfPoint, feature as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>)) {
          return true
        }
      } catch {
        // skip malformed features
      }
    }
  }
  return false
}

/**
 * Returns true if a road layer is found within 30px of the given screen point.
 * Uses MapLibre queryRenderedFeatures with a pixel radius box around the point.
 * Falls back to true (assume accessible) if no transportation layers exist.
 */
export function hasRoadAccess(map: MapLibreMap, pt: [number, number]): boolean {
  try {
    const screenPt = map.project(pt as [number, number])
    const radius = 30
    const bbox: [[number, number], [number, number]] = [
      [screenPt.x - radius, screenPt.y - radius],
      [screenPt.x + radius, screenPt.y + radius],
    ]

    // Find all layers that use the 'transportation' source-layer (OpenMapTiles schema)
    const style = map.getStyle()
    const transportLayers = (style.layers ?? [])
      .filter((l) => 'source-layer' in l && l['source-layer'] === 'transportation')
      .map((l) => l.id)

    if (transportLayers.length === 0) {
      // No transportation layers in current style — assume accessible
      return true
    }

    const features = map.queryRenderedFeatures(bbox, { layers: transportLayers })
    return features.length > 0
  } catch {
    // If anything goes wrong, assume road access exists
    return true
  }
}
