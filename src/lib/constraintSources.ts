import type { ConstraintType } from '@/types/constraints'

/**
 * Build the request body for the server-side /api/constraints proxy.
 * The proxy resolves to different external endpoints per constraint type.
 */
export interface ConstraintFetchRequest {
  constraintType: ConstraintType
  /** GeoJSON geometry of the site + buffer (WGS84) */
  geometry: GeoJSON.Geometry
}

/**
 * planning.data.gov.uk dataset slugs per constraint type.
 * The constraint proxy server uses these to build the entity.geojson URL.
 */
export const PLANNING_DATA_DATASETS: Partial<Record<ConstraintType, string>> = {
  'green-belt': 'green-belt',
  'conservation-area': 'conservation-area',
  'article-4': 'article-4-direction-area',
}

/**
 * Returns the external URL for a constraint type and a WGS84 bounding box.
 * This is used server-side in the /api/constraints route handler.
 */
export function buildConstraintUrl(
  constraintType: ConstraintType,
  bbox: { west: number; south: number; east: number; north: number },
): string {
  const { west, south, east, north } = bbox

  // Build WKT polygon for the bounding box
  const wkt = `POLYGON((${west} ${south},${east} ${south},${east} ${north},${west} ${north},${west} ${south}))`

  if (constraintType === 'flood-risk') {
    // Environment Agency WFS endpoint
    const bboxStr = `${south},${west},${north},${east},urn:ogc:def:crs:EPSG::4326`
    return (
      `https://environment.data.gov.uk/spatialdata/flood-map-for-planning-rivers-and-sea-flood-zone-3/wfs` +
      `?service=WFS&version=2.0.0&request=GetFeature` +
      `&typeName=Flood_Map_for_Planning_Rivers_and_Sea_Flood_Zone_3` +
      `&outputFormat=application/json` +
      `&bbox=${bboxStr}` +
      `&count=200`
    )
  }

  const dataset = PLANNING_DATA_DATASETS[constraintType]
  if (!dataset) throw new Error(`Unknown constraint type: ${constraintType}`)

  return (
    `https://www.planning.data.gov.uk/entity.geojson` +
    `?dataset=${dataset}` +
    `&geometry=${encodeURIComponent(wkt)}` +
    `&geometry_relation=intersects` +
    `&limit=100`
  )
}

/**
 * Extract a WGS84 bounding box from a GeoJSON geometry.
 */
export function geometryToBbox(geometry: GeoJSON.Geometry): {
  west: number
  south: number
  east: number
  north: number
} {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity

  function processCoords(coords: unknown): void {
    if (Array.isArray(coords)) {
      if (typeof coords[0] === 'number') {
        const [lng, lat] = coords as number[]
        if (lng < minLng) minLng = lng
        if (lng > maxLng) maxLng = lng
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      } else {
        coords.forEach(processCoords)
      }
    }
  }

  processCoords((geometry as { coordinates: unknown }).coordinates)

  return { west: minLng, south: minLat, east: maxLng, north: maxLat }
}
