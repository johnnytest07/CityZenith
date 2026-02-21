// IBEX /search request — matches SearchRequestSchema
export interface SearchRequest {
  input: {
    srid: 27700
    polygon: {
      geometry: {
        type: 'Polygon'
        coordinates: number[][][]
      }
    }
  }
  extensions?: {
    appeals?: boolean
    centre_point?: boolean
    heading?: boolean
    project_type?: boolean
    num_new_houses?: boolean
    document_metadata?: boolean
    proposed_unit_mix?: boolean
    proposed_floor_area?: boolean
    num_comments_received?: boolean
  }
  filters?: {
    normalised_application_type?: string[]
    project_type?: string[]
    normalised_decision?: string[]
    num_new_houses?: Record<string, unknown>
  }
}

// IBEX /stats request — matches StatsRequestSchema (council-based, NOT polygon-based)
export interface StatsRequest {
  input: {
    council_id: number
    date_from: string  // YYYY-MM-DD
    date_to: string    // YYYY-MM-DD
  }
}

// Planning application as returned by IBEX /search
export interface PlanningApplication {
  planning_reference: string
  proposal: string | null
  normalised_decision: string | null
  raw_decision: string | null
  geometry: string | null          // WKT string in EPSG:27700, e.g. "POINT(528349 186246)"
  centre_point: string | null      // WKT point in EPSG:27700 (requires centre_point extension)
  council_id: number | null
  council_name: string | null
  normalised_application_type: string | null
  application_date: string | null  // ISO date string
  decided_date: string | null      // ISO date string
  classifications: string[] | null
  appeal_decision: string | null
  appeal_date: string | null
  heading: string | null
  num_new_houses: number | null
  url: string | null
  raw_address: string | null
}

// IBEX /stats response — matches StatsResponseSchema
export interface PlanningContextStats {
  approval_rate: number | null
  refusal_rate: number | null
  average_decision_time: Record<string, number> | null  // keyed by project type, value in days
  number_of_applications: Record<string, number> | null // keyed by application type
  number_of_new_homes_approved: number | null
  council_development_activity_level: string | null
}
