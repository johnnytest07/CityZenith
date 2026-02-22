import { booleanPointInPolygon, booleanIntersects, area, centroid, polygon as turfPolygon, point } from '@turf/turf'
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
 * Returns true if the given closed polygon ring intersects any building in the collection.
 * polygonCoords must be a closed ring (first === last point).
 */
export function polygonIntersectsBuilding(
  polygonCoords: [number, number][],
  buildings: GeoJSON.FeatureCollection,
): boolean {
  const poly = turfPolygon([polygonCoords])
  for (const feature of buildings.features) {
    if (
      feature.geometry.type === 'Polygon' ||
      feature.geometry.type === 'MultiPolygon'
    ) {
      try {
        if (booleanIntersects(poly, feature as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>)) {
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
 * Returns the area in m² of the polygon defined by the given nodes (open ring — do not repeat first point).
 */
export function calculatePolygonArea(nodes: [number, number][]): number {
  if (nodes.length < 3) return 0
  const closedRing = [...nodes, nodes[0]]
  try {
    return area(turfPolygon([closedRing]))
  } catch {
    return 0
  }
}

/**
 * Returns the centroid [lng, lat] of the polygon defined by the given nodes.
 */
export function calculatePolygonCentroid(nodes: [number, number][]): [number, number] {
  if (nodes.length < 3) return nodes[0] ?? [0, 0]
  const closedRing = [...nodes, nodes[0]]
  try {
    const c = centroid(turfPolygon([closedRing]))
    return c.geometry.coordinates as [number, number]
  } catch {
    return nodes[0]
  }
}

/**
 * Returns true if any road/transport feature is found within 30 geographic metres
 * of the polygon boundary (centroid + every vertex).
 *
 * Previous approach checked only the centroid with a fixed 30-pixel radius.
 * That fails for typical building plots where the road fronts one edge, not the
 * centre, and 30px shrinks to ~1 m at high zoom levels.
 *
 * This version:
 *  1. Converts 30 m → pixels at the current zoom and latitude.
 *  2. Queries centroid + every polygon vertex (not just the centroid).
 *  3. Matches 'transportation', 'road', 'roads', and 'transport' source-layers
 *     so it works across MapTiler schema variants.
 */
export function hasRoadAccess(
  map: MapLibreMap,
  polygonNodes: [number, number][],
): boolean {
  try {
    const style = map.getStyle()

    // Collect all layers from any known road source-layer name
    const transportLayers = (style.layers ?? [])
      .filter((l) => {
        if (!('source-layer' in l)) return false
        const sl = (l as { 'source-layer': string })['source-layer']
        return (
          sl === 'transportation' ||
          sl === 'road' ||
          sl === 'roads' ||
          sl === 'transport'
        )
      })
      .map((l) => l.id)

    if (transportLayers.length === 0) return true  // no transport layers → assume accessible

    // Convert 30 m → pixels at this zoom level and latitude
    const refLat = (polygonNodes[0]?.[1] ?? 51.5) * (Math.PI / 180)
    const zoom = map.getZoom()
    const metersPerPx =
      (156543.03392 * Math.cos(refLat)) / Math.pow(2, zoom)
    // At least 20 px so the box always catches lines that are rendered at 1 px width
    const radiusPx = Math.max(20, Math.ceil(30 / metersPerPx))

    // Check centroid + every drawn vertex; any single hit means access is present
    const centroidPt = calculatePolygonCentroid(polygonNodes)
    const checkPoints: [number, number][] = [centroidPt, ...polygonNodes]

    for (const pt of checkPoints) {
      const sp = map.project(pt as [number, number])
      const bbox: [[number, number], [number, number]] = [
        [sp.x - radiusPx, sp.y - radiusPx],
        [sp.x + radiusPx, sp.y + radiusPx],
      ]
      const hits = map.queryRenderedFeatures(bbox, { layers: transportLayers })
      if (hits.length > 0) return true
    }

    return false
  } catch {
    return true  // on any error, assume accessible
  }
}
