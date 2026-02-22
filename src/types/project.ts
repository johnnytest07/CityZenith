import type { RecommendFactor } from './devMode'

export type ProjectType =
  | 'renovation'
  | 'new-build'
  | 'demolish-rebuild'
  | 'extension'
  | 'change-of-use'
  | 'subdivision'

export interface ProjectTypeMeta {
  label: string
  icon: string
  description: string
}

export const PROJECT_TYPE_META: Record<ProjectType, ProjectTypeMeta> = {
  'renovation':       { label: 'Renovation',        icon: '🔨', description: 'Refurbish existing building'        },
  'new-build':        { label: 'New Build',          icon: '🏗️', description: 'Construct a new building on site'  },
  'demolish-rebuild': { label: 'Demolish & Rebuild', icon: '💥', description: 'Clear site and build from scratch' },
  'extension':        { label: 'Extension',          icon: '📐', description: 'Extend the existing structure'     },
  'change-of-use':    { label: 'Change of Use',      icon: '🔄', description: 'Convert to a different use class'  },
  'subdivision':      { label: 'Subdivision',        icon: '🏢', description: 'Divide into multiple units'        },
}

export const PROJECT_TYPES = Object.keys(PROJECT_TYPE_META) as ProjectType[]

export interface ProjectBuilding {
  heightM: number | null
  buildingType: string | null
  buildingUse: string | null
  impliedStoreys: number | null
  lngLat: [number, number]
  footprintM2: number | null
  rawProperties: Record<string, unknown>
  geometry: GeoJSON.Geometry | null
}

export interface ApprovalLikelihood {
  percent: number
  confidence: 'high' | 'medium' | 'low'
  summary: string
  supportingPrecedents: string[]
  riskFactors: string[]
  comparableCases: number
}

export interface ProjectFinancials {
  projectType: ProjectType
  primaryMetric: string
  primaryValue: string

  totalInvestment: number | null
  netProfitEstimate: number | null

  // Renovation / Demolish-Rebuild
  gdvEstimate?: number
  renovationCostRange?: [number, number]
  roiPercent?: number

  // New Build / Demolish-Rebuild
  buildCostRange?: [number, number]
  demolitionCost?: number
  developmentMarginPercent?: number

  // Extension
  extensionCostRange?: [number, number]
  valueUplift?: number
  upliftPercent?: number

  // Change of Use
  suggestedUse?: string

  // Subdivision
  unitCount?: number
  gdvPerUnit?: number

  summary: string
  factors: RecommendFactor[]
  confidence: 'high' | 'medium' | 'low'
}

export interface ProjectResult {
  approval: ApprovalLikelihood | null
  financials: ProjectFinancials | null
  approvalError?: string
  financialsError?: string
}

export type ProjectStep = 'idle' | 'select-type' | 'awaiting-click' | 'loading' | 'result' | 'error'
