export interface BuildingOption {
  buildingType: string
  style: string
  storeys: number
  approxFootprintM2: number
  approxHeightM: number
  reasoning: string
}

export interface BuildRecommendation {
  primary: BuildingOption
  alternatives: BuildingOption[]
  activeIndex: number
}

export type BuildStep = 'idle' | 'place' | 'loading' | 'result'
