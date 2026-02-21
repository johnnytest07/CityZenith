export type SuggestionType =
  | 'troubled_area'
  | 'opportunity_zone'
  | 'park'
  | 'housing'
  | 'bridge'
  | 'community'
  | 'mixed_use'
  | 'transport'

export interface ImplementationOption {
  type: SuggestionType
  title: string
  description: string
  centerPoint: [number, number] // [lng, lat]
  radiusM: number               // buffer radius to generate polygon
  heightM: number | null        // null = flat; number = 3D extrusion height
  color: [number, number, number, number]
  policyBasis: string
  /** Pre-computed polygon from centerPoint + radiusM buffer (set at normalisation time) */
  geometry?: GeoJSON.Geometry
}

export interface CouncilSuggestion {
  id: string
  stage: number
  geometry: GeoJSON.Geometry     // approximate area polygon (buffer of centerPoint)
  type: SuggestionType
  title: string                  // e.g. "South Thamesmead Industrial Zone"
  rationale: string              // 1-2 sentences for tooltip
  reasoning: string              // 3-5 paragraphs for expand dropdown
  priority: 'high' | 'medium' | 'low'
  evidenceSources: string[]
  policyBasis: string            // e.g. "Local Plan Policy RE1"
  implementations: ImplementationOption[]
}

export interface AnalysisStage {
  stageNum: number
  name: string
  description: string
  status: 'pending' | 'running' | 'complete'
  suggestionCount: number
}
