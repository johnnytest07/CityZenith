import type { PlanningApplication } from '@/types/ibex'
import type { DeveloperMetrics } from '@/types/siteContext'
import { osgbToWgs84 } from './coords'
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
  applicationDate: string | null,
  decidedDate: string | null,
): number | null {
  if (!applicationDate || !decidedDate) return null
  const submitted = Date.parse(applicationDate)
  const decided = Date.parse(decidedDate)
  if (isNaN(submitted) || isNaN(decided)) return null
  return Math.round((decided - submitted) / 86_400_000)
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
    decisionSpeedDays: computeDecisionSpeedDays(app.application_date, app.decided_date),
  }
}

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
 * All original application properties are preserved in feature.properties
 * including the new extension fields (unit mix, floor area, appeals, etc.).
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
        polygon = bufferCentroid(parsedGeom.coordinates as [number, number], 0.015)
        geometrySource = 'buffered-centroid'
      }
    } else if (app.centre_point) {
      const centreGeom = parseWktOsgb(app.centre_point)
      if (centreGeom?.type === 'Point') {
        polygon = bufferCentroid(centreGeom.coordinates as [number, number], 0.015)
        geometrySource = 'buffered-centroid'
      }
    }

    if (!polygon) continue

    // For buffered-centroid features, extract and store lat/lng so MapCanvas
    // can place popups at the original address rather than the polygon centroid.
    let latitude: number | null = null
    let longitude: number | null = null
    if (geometrySource === 'buffered-centroid') {
      const centreWkt = parsedGeom?.type === 'Point'
        ? app.geometry
        : app.centre_point
      const centreGeom = parseWktOsgb(centreWkt ?? null)
      if (centreGeom?.type === 'Point') {
        ;[longitude, latitude] = centreGeom.coordinates as [number, number]
      }
    }

    const metrics = enrichApplication(app)

    // Appeals: extract the first appeal outcome for quick access on the map
    const firstAppeal = app.appeals?.[0] ?? null

    // Unit mix: flatten key counts for use in panel without JSON.parse
    const unitMix = app.proposed_unit_mix
    const totalUnits = unitMix?.total_proposed_residential_units ?? null
    const affordableUnits = unitMix?.proposed_affordable_units ?? unitMix?.affordable_housing_units ?? null
    const bed1 = unitMix?.proposed_1_bed_units ?? null
    const bed2 = unitMix?.proposed_2_bed_units ?? null
    const bed3 = unitMix?.proposed_3_bed_units ?? null
    const bed4plus = unitMix?.proposed_4_plus_bed_units ?? null

    const feature: GeoJSON.Feature = {
      type: 'Feature',
      geometry: polygon.geometry,
      properties: {
        // Core identifiers
        planning_reference: app.planning_reference,
        url: app.url,
        raw_address: app.raw_address,
        council_id: app.council_id,
        council_name: app.council_name,

        // Application details
        proposal: app.proposal,
        normalised_application_type: app.normalised_application_type,
        application_date: app.application_date,
        decided_date: app.decided_date,
        normalised_decision: app.normalised_decision,
        raw_decision: app.raw_decision,

        // Extensions
        heading: app.heading,
        project_type: app.project_type,
        num_new_houses: app.num_new_houses,
        num_comments_received: app.num_comments_received,

        // Unit mix (flattened for direct property access)
        unit_total: totalUnits,
        unit_affordable: affordableUnits,
        unit_1bed: bed1,
        unit_2bed: bed2,
        unit_3bed: bed3,
        unit_4plus: bed4plus,

        // Floor area
        floor_area_added_sqm: app.proposed_floor_area?.gross_internal_area_to_add_sqm ?? null,
        floor_area_proposed_sqm: app.proposed_floor_area?.proposed_gross_floor_area_sqm ?? null,

        // Appeal outcome
        appeal_decision: firstAppeal?.decision ?? null,
        appeal_date: firstAppeal?.decision_date ?? null,
        appeal_ref: firstAppeal?.appeal_ref ?? null,
        appeal_case_type: firstAppeal?.case_type ?? null,

        // Developer metrics (computed at normalisation time — intentional exception to raw-evidence rule)
        developer_metrics: metrics,

        // Geometry metadata
        geometrySource,
        latitude,
        longitude,
      },
    }

    features.push(feature)
  }

  return { type: 'FeatureCollection', features }
}
