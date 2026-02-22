import type { BuildingOption } from '@/types/devMode'

export interface ViabilityScore {
  total: number           // 0–100
  label: 'Viable' | 'Marginal' | 'Constrained'
  positiveFactors: number
  negativeFactors: number
  neutralFactors: number
}

export function calculateViabilityScore(option: BuildingOption): ViabilityScore {
  const base = option.likelihood === 'high' ? 70 : option.likelihood === 'medium' ? 45 : 20

  const positiveFactors = option.factors.filter((f) => f.impact === 'positive').length
  const negativeFactors = option.factors.filter((f) => f.impact === 'negative').length
  const neutralFactors  = option.factors.filter((f) => f.impact === 'neutral').length

  const total = Math.min(100, Math.max(0, base + positiveFactors * 5 - negativeFactors * 5))

  const label: ViabilityScore['label'] =
    total >= 70 ? 'Viable' : total >= 40 ? 'Marginal' : 'Constrained'

  return { total, label, positiveFactors, negativeFactors, neutralFactors }
}
