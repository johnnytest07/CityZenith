import type { PlanningApplication } from '@/types/ibex'
import type { DeveloperMetrics } from '@/types/siteContext'
import { bufferCentroid } from './geometry'

export type GeometrySource = 'application-geometry' | 'buffered-centroid'

// ─── Developer metrics ────────────────────────────────────────────────────

const HIGH_VALUE_KEYWORDS = [
  'HMO',
  'Conversion',
  'New Build',
  'AirBnB',
  'Demolition',
  'Change of Use',
] as const

const COMPLEX_APP_TYPES = [
  'full',
  'outline',
  'listed-building-consent',
  'conservation-area-consent',
]

function computeComplexityScore(
  applicationType: string | null,
  proposal: string | null,
): 'High' | 'Medium' | 'Low' {
  const isComplexType = applicationType
    ? COMPLEX_APP_TYPES.some((t) => applicationType.toLowerCase().includes(t))
    : false
  const isLongProposal = (proposal?.length ?? 0) > 200
  if (isComplexType && isLongProposal) return 'High'
  if (isComplexType || isLongProposal) return 'Medium'
  return 'Low'
}

function computeHighValueTags(proposal: string | null): string[] {
  if (!proposal) return []
  const lower = proposal.toLowerCase()
  return HIGH_VALUE_KEYWORDS.filter((kw) => lower.includes(kw.toLowerCase()))
}

function computeDecisionSpeedDays(
  receivedDate: string | null,
  decisionDate: string | null,
): number | null {
  if (!receivedDate || !decisionDate) return null
  const received = Date.parse(receivedDate)
  const decided = Date.parse(decisionDate)
  if (isNaN(received) || isNaN(decided)) return null
  return Math.round((decided - received) / 86_400_000)
}

/**
 * Compute developer intelligence metrics from raw application properties.
 * Called during normalisation so the visualization layer can drive styling
 * without re-computing per render.
 */
export function enrichApplication(app: PlanningApplication): DeveloperMetrics {
  const highValueTags = computeHighValueTags(app.proposal)
  return {
    complexityScore: computeComplexityScore(app.normalised_application_type, app.proposal),
    isHighValue: highValueTags.length > 0,
    highValueTags,
    decisionSpeedDays: computeDecisionSpeedDays(app.received_date, app.decision_date),
  }
}

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
