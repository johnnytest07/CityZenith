import type { PlanningApplication } from '@/types/ibex'
import { bufferCentroid } from './geometry'

export type GeometrySource = 'application-geometry' | 'buffered-centroid'

/**
 * Normalise an array of IBEX PlanningApplication objects into a uniform
 * GeoJSON FeatureCollection where EVERY feature is a polygon.
 *
 * Rules:
 *  - If the application has polygon/multipolygon geometry → use it as-is
 *  - If the application has point geometry → use it as centroid, generate 50m buffer
 *  - If no geometry but has lat/lng → generate 50m buffer from centroid
 *  - If no usable geometry → skip (do not include in collection)
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

    if (app.geometry) {
      const geomType = app.geometry.type
      if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
        // Use application geometry directly
        polygon = {
          type: 'Feature',
          geometry: app.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon,
          properties: {},
        }
        geometrySource = 'application-geometry'
      } else if (geomType === 'Point') {
        // Application has a centroid point — buffer it
        const coords = (app.geometry as unknown as GeoJSON.Point).coordinates as [number, number]
        polygon = bufferCentroid(coords, 0.05)
        geometrySource = 'buffered-centroid'
      }
    } else if (app.longitude !== null && app.latitude !== null) {
      // No geometry but has lat/lng — buffer the centroid
      polygon = bufferCentroid([app.longitude, app.latitude], 0.05)
      geometrySource = 'buffered-centroid'
    }

    if (!polygon) continue // skip if no usable geometry

    const feature: GeoJSON.Feature = {
      type: 'Feature',
      geometry: polygon.geometry,
      properties: {
        planning_reference: app.planning_reference,
        proposal: app.proposal,
        decision: app.decision,
        normalised_decision: app.normalised_decision,
        latitude: app.latitude,
        longitude: app.longitude,
        council_id: app.council_id,
        normalised_application_type: app.normalised_application_type,
        received_date: app.received_date,
        decision_date: app.decision_date,
        classifications: app.classifications ? JSON.stringify(app.classifications) : null,
        appeal_decision: app.appeal_decision,
        appeal_date: app.appeal_date,
        geometrySource,
      },
    }

    features.push(feature)
  }

  return {
    type: 'FeatureCollection',
    features,
  }
}
