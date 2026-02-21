import type { PlanningContextStats } from './ibex'
import type { StatutoryConstraints } from './constraints'

/**
 * SiteContext — the primary domain object.
 *
 * Stores ONLY raw spatial evidence tied to the selected parcel.
 * No min/max/mean/counts/density — those are computed at render-time
 * inside panel components and never persisted here.
 */
export interface SiteContext {
  /** UUID generated on each site selection */
  siteId: string

  /** Selected parcel polygon in WGS84 (GeoJSON) */
  siteGeometry: GeoJSON.Geometry

  /**
   * Planning applications normalised to a uniform FeatureCollection.
   * Every feature is a polygon:
   *   - geometrySource: 'application-geometry' — real site boundary from IBEX
   *   - geometrySource: 'buffered-centroid'    — 50m circle around centroid (fallback)
   * All original IBEX application properties are preserved in feature.properties.
   */
  planningPrecedentFeatures: GeoJSON.FeatureCollection

  /** Unmodified stats response from IBEX POST /stats */
  planningContextStats: PlanningContextStats | null

  /** Constraint datasets auto-fetched on site click */
  statutoryConstraints: StatutoryConstraints

  /**
   * Raw building and land use features from MapLibre OSM vector tiles
   * within 250m of the site centre.
   * No derived values stored here — computed at render-time only.
   */
  nearbyContextFeatures: NearbyContextFeatures
}

export interface NearbyContextFeatures {
  /** Raw building polygon features from OSM 'building' source-layer */
  buildings: GeoJSON.FeatureCollection
  /** Raw land use polygon features from OSM 'landuse' source-layer */
  landuse: GeoJSON.FeatureCollection
  /** Query radius used — 250 */
  queryRadiusM: number
}

/** Loading state tracked per data source */
export interface SiteLoadingStates {
  precedent: boolean
  stats: boolean
  constraints: boolean
  contextFeatures: boolean
}
