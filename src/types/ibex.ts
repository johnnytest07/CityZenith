export interface PolygonSearchRequest {
  polygon: number[][]
  srid: 27700
  extensions?: string[]
  filters?: Record<string, unknown>
  page?: number
  page_size?: number
}

export interface StatsRequest {
  polygon: number[][]
  srid: 27700
  filters?: Record<string, unknown>
}

export interface PlanningApplication {
  planning_reference: string
  proposal: string | null
  decision: string | null
  normalised_decision: string | null
  latitude: number | null
  longitude: number | null
  geometry: GeoJSONGeometryRaw | null
  council_id: string | null
  normalised_application_type: string | null
  received_date: string | null
  decision_date: string | null
  classifications: string[] | null
  appeal_decision: string | null
  appeal_date: string | null
}

// Raw geometry as returned by IBEX (may be OSGB or WGS84 depending on endpoint config)
export interface GeoJSONGeometryRaw {
  type: 'Point' | 'Polygon' | 'MultiPolygon' | 'LineString' | 'GeometryCollection'
  coordinates: unknown
}

// IBEX StatsResponseSchema
export interface PlanningContextStats {
  averageDecisionTime: AverageDecisionTime | null
  numberOfApplications: NumberOfApplications | null
  outcomeDistributions: OutcomeDistribution[] | null
  developmentActivityLevel: string | null
}

export interface AverageDecisionTime {
  days: number | null
  weeks: number | null
  byType?: Record<string, number>
}

export interface NumberOfApplications {
  total: number
  byType: Record<string, number>
}

export interface OutcomeDistribution {
  decision: string
  count: number
  percentage: number
}
