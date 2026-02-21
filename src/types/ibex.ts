// ─── Sub-types ────────────────────────────────────────────────────────────────

export interface IbexAppeal {
  appeal_ref: string
  appeal_url: string | null
  start_date: string | null
  decision_date: string | null
  decision: string | null
  case_type: string | null
}

export interface ProposedUnitMix {
  total_existing_residential_units: number | null
  total_proposed_residential_units: number | null
  proposed_1_bed_units: number | null
  proposed_2_bed_units: number | null
  proposed_3_bed_units: number | null
  proposed_4_plus_bed_units: number | null
  affordable_housing_units: number | null
  proposed_flat_count: number | null
  proposed_market_units: number | null
  proposed_affordable_units: number | null
  proposed_social_rent_units: number | null
  proposed_shared_ownership_units: number | null
}

export interface ProposedFloorArea {
  gross_internal_area_to_add_sqm: number | null
  existing_gross_floor_area_sqm: number | null
  proposed_gross_floor_area_sqm: number | null
  floor_area_to_be_lost_sqm: number | null
  floor_area_to_be_gained_sqm: number | null
}

export interface DocumentMetadataItem {
  date_published: string | null
  document_type: string | null
  description: string | null
  document_link: string | null
}

// ─── /search request ─────────────────────────────────────────────────────────

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
    unlimited_radius?: boolean
  }
  filters?: {
    normalised_application_type?: string[]
    project_type?: string[]
    normalised_decision?: string[]
    num_new_houses?: { min?: number; max?: number }
  }
}

// ─── /stats request ───────────────────────────────────────────────────────────

export interface StatsRequest {
  input: {
    council_id: number
    date_from: string  // YYYY-MM-DD
    date_to: string    // YYYY-MM-DD
  }
}

// ─── /applications request ───────────────────────────────────────────────────

export interface ApplicationsRequest {
  input: {
    council_id?: number[]
    date_from: string
    date_to: string
    date_range_type?: 'validated' | 'decided' | 'any'
    page?: number
    page_size?: number
  }
  extensions?: {
    project_type?: boolean
    heading?: boolean
    appeals?: boolean
    num_new_houses?: boolean
    document_metadata?: boolean
    proposed_unit_mix?: boolean
    proposed_floor_area?: boolean
    num_comments_received?: boolean
  }
  filters?: {
    normalised_application_type?: string[]
    keywords?: string[]
    normalised_decision?: string[]
    num_new_houses?: { min?: number; max?: number }
  }
}

// ─── Planning application (shared across /search and /applications) ───────────

export interface PlanningApplication {
  planning_reference: string
  proposal: string | null
  normalised_decision: string | null
  raw_decision: string | null
  geometry: string | null         // WKT in EPSG:27700
  centre_point: string | null     // WKT point (requires centre_point extension)
  council_id: number | null
  council_name: string | null
  normalised_application_type: string | null
  raw_application_type: string | null
  application_date: string | null // ISO date — submission/validation date
  decided_date: string | null     // ISO date — decision date
  raw_address: string | null
  url: string | null

  // Extensions (present only when requested)
  appeals: IbexAppeal[] | null
  heading: string | null
  project_type: string | null
  num_new_houses: number | null
  num_comments_received: number | null
  proposed_unit_mix: ProposedUnitMix | null
  proposed_floor_area: ProposedFloorArea | null
  document_metadata: DocumentMetadataItem[] | null
}

// ─── /stats response ─────────────────────────────────────────────────────────

export interface PlanningContextStats {
  approval_rate: number | null
  refusal_rate: number | null
  /** Average decision time in days, keyed by project_type */
  average_decision_time: Record<string, number> | null
  /** Count of applications, keyed by normalised_application_type */
  number_of_applications: Record<string, number> | null
  number_of_new_homes_approved: number | null
  council_development_activity_level: string | null
}

// ─── Council pipeline (processed result from /applications) ──────────────────

export interface CouncilPipelineItem {
  planning_reference: string
  heading: string | null
  proposal: string | null
  decided_date: string | null
  project_type: string | null
  num_new_houses: number | null
  proposed_unit_mix: ProposedUnitMix | null
  proposed_floor_area: ProposedFloorArea | null
}

export interface CouncilPipeline {
  councilId: number
  councilName: string
  fetchedAt: string
  /** Approved residential schemes (num_new_houses ≥ 1) decided in last 2 years */
  applications: CouncilPipelineItem[]
}
