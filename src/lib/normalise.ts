import type { PlanningApplication } from '@/types/ibex'
import { osgbToWgs84 } from './coords'
import { bufferCentroid } from './geometry'

export type GeometrySource = 'application-geometry' | 'buffered-centroid'

/**
 * Parse a WKT geometry string in EPSG:27700 → GeoJSON geometry in WGS84.
 * Handles POINT(x y) and POLYGON((x1 y1, x2 y2, ...)) formats returned by IBEX.
 */
function parseWktOsgb(wkt: string | null): GeoJSON.Geometry | null {
  if (!wkt) return null
  const w = wkt.trim()

  // POINT(x y)
  const pointMatch = w.match(/^POINT\s*\(\s*([\d.eE+-]+)\s+([\d.eE+-]+)\s*\)$/i)
  if (pointMatch) {
    const [lng, lat] = osgbToWgs84(parseFloat(pointMatch[1]), parseFloat(pointMatch[2]))
    return { type: 'Point', coordinates: [lng, lat] }
  }

  // POLYGON((x1 y1, x2 y2, ...)) — exterior ring only, ignore holes for MVP
  const polygonMatch = w.match(/^POLYGON\s*\(\(([^)]+)\)/i)
  if (polygonMatch) {
    const ring = polygonMatch[1].split(',').map((pair) => {
      const parts = pair.trim().split(/\s+/)
      return osgbToWgs84(parseFloat(parts[0]), parseFloat(parts[1])) as [number, number]
    })
    return { type: 'Polygon', coordinates: [ring] }
  }

  return null
}

/**
 * Normalise an array of IBEX PlanningApplication objects into a uniform
 * GeoJSON FeatureCollection where EVERY feature is a polygon.
 *
 * Rules:
 *  - If app.geometry is a WKT polygon → use it directly
 *  - If app.geometry is a WKT point → buffer 50m
 *  - If no geometry but centre_point extension is present → buffer 50m
 *  - If no usable geometry → skip
 *
 * All original PlanningApplication properties are preserved in feature.properties
 * plus `geometrySource` indicating how the polygon was derived.
 */
export function normaliseApplicationsToFeatures(
  applications: PlanningApplication[],
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []

  for (const app of applications) {
    let polygon: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null = null
    let geometrySource: GeometrySource = 'application-geometry'

    const parsedGeom = parseWktOsgb(app.geometry)

    if (parsedGeom) {
      if (parsedGeom.type === 'Polygon' || parsedGeom.type === 'MultiPolygon') {
        polygon = {
          type: 'Feature',
          geometry: parsedGeom as GeoJSON.Polygon | GeoJSON.MultiPolygon,
          properties: {},
        }
        geometrySource = 'application-geometry'
      } else if (parsedGeom.type === 'Point') {
        // IBEX returned a point geometry — buffer it to a 50m circle
        polygon = bufferCentroid(parsedGeom.coordinates as [number, number], 0.05)
        geometrySource = 'buffered-centroid'
      }
    } else if (app.centre_point) {
      // Fallback: use the centre_point extension field if main geometry is absent
      const centreGeom = parseWktOsgb(app.centre_point)
      if (centreGeom?.type === 'Point') {
        polygon = bufferCentroid(centreGeom.coordinates as [number, number], 0.05)
        geometrySource = 'buffered-centroid'
      }
    }

    if (!polygon) continue // no usable geometry — skip

    const feature: GeoJSON.Feature = {
      type: 'Feature',
      geometry: polygon.geometry,
      properties: {
        planning_reference: app.planning_reference,
        proposal: app.proposal,
        normalised_decision: app.normalised_decision,
        raw_decision: app.raw_decision,
        council_id: app.council_id,
        council_name: app.council_name,
        normalised_application_type: app.normalised_application_type,
        application_date: app.application_date,
        decided_date: app.decided_date,
        classifications: app.classifications ? JSON.stringify(app.classifications) : null,
        appeal_decision: app.appeal_decision,
        appeal_date: app.appeal_date,
        heading: app.heading,
        num_new_houses: app.num_new_houses,
        url: app.url,
        raw_address: app.raw_address,
        geometrySource,
      },
    }

    features.push(feature)
  }

  return { type: 'FeatureCollection', features }
}
