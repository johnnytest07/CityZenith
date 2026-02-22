import type { RecommendFactor } from './devMode'

export interface RenovationBuilding {
  heightM: number | null
  buildingType: string | null       // OSM 'building' tag (null if value is 'yes')
  buildingUse: string | null        // OSM 'building:use' tag
  impliedStoreys: number | null     // round(heightM / 3), min 1
  lngLat: [number, number]
  footprintM2: number | null        // turf.area() of clicked feature
  rawProperties: Record<string, unknown>
}

export interface RenovationResult {
  gdvEstimate: number               // £ integer
  renovationCostRange: [number, number]  // [low, high] £
  netProfitEstimate: number         // £ integer
  roiPercent: number                // e.g. 18.5
  summary: string                   // 2–3 sentence narrative
  factors: RecommendFactor[]        // 4–5, reuses existing type from devMode.ts
  confidence: 'high' | 'medium' | 'low'
}

export type RenovStep = 'idle' | 'loading' | 'result' | 'error'
