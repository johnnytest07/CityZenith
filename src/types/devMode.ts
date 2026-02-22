export interface RecommendFactor {
  /** Short label, e.g. "Approval rate" */
  label: string
  /** Formatted value, e.g. "76%" or "9.5m vs 7.3m avg" */
  value: string
  /** Visual colour signal */
  impact: 'positive' | 'neutral' | 'negative'
}

export interface BuildingOption {
  buildingType: string
  style: string
  storeys: number
  approxFootprintM2: number
  approxHeightM: number
  /** 'high' | 'medium' | 'low' — overall planning likelihood signal */
  likelihood: 'high' | 'medium' | 'low'
  /** 3–4 concise bullet points, key numbers wrapped in **bold** */
  reasoning: string[]
  /** Key evidence factors that drove this recommendation */
  factors: RecommendFactor[]
}

export interface BuildRecommendation {
  primary: BuildingOption
  alternatives: BuildingOption[]
  activeIndex: number
}

export type BuildStep = 'idle' | 'place' | 'loading' | 'result'
