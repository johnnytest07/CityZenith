import type { SuggestionType } from '@/types/council'

/** RGBA colour tuples for deck.gl layers */
export type RgbaColor = [number, number, number, number]

export const DECISION_COLORS: Record<string, RgbaColor> = {
  Approved: [34, 197, 94, 88],      // green-500, semi-transparent (visible through refused)
  Refused: [230, 10, 28, 115],      // vivid sharp red, slightly more opaque so overlap tints orange
  Undetermined: [156, 163, 175, 45], // grey-400, light wash
}

export const DECISION_STROKE_COLORS: Record<string, RgbaColor> = {
  Approved: [22, 163, 74, 255],     // green-600
  Refused: [220, 10, 20, 255],      // vivid sharp red — no orange tint, full saturation
  Undetermined: [107, 114, 128, 255], // grey-500
}

export const CONSTRAINT_FILL_COLORS: Record<string, RgbaColor> = {
  'green-belt': [34, 197, 94, 38],
  'conservation-area': [245, 158, 11, 38],
  'article-4': [168, 85, 247, 38],
  'flood-risk': [59, 130, 246, 51],
}

export const CONSTRAINT_STROKE_COLORS: Record<string, RgbaColor> = {
  'green-belt': [22, 163, 74, 200],
  'conservation-area': [217, 119, 6, 200],
  'article-4': [126, 34, 206, 200],
  'flood-risk': [37, 99, 235, 200],
}

/**
 * Returns a fill colour for a planning application based on its normalised_decision.
 * Performs a case-insensitive substring match so variations like
 * "Approved with Conditions" still map to green.
 */
export function getDecisionFillColor(decision: string | null): RgbaColor {
  if (!decision) return DECISION_COLORS.Undetermined
  const d = decision.toLowerCase()
  if (d.includes('approv')) return DECISION_COLORS.Approved
  if (d.includes('refus') || d.includes('reject')) return DECISION_COLORS.Refused
  return DECISION_COLORS.Undetermined
}

export function getDecisionStrokeColor(decision: string | null): RgbaColor {
  if (!decision) return DECISION_STROKE_COLORS.Undetermined
  const d = decision.toLowerCase()
  if (d.includes('approv')) return DECISION_STROKE_COLORS.Approved
  if (d.includes('refus') || d.includes('reject')) return DECISION_STROKE_COLORS.Refused
  return DECISION_STROKE_COLORS.Undetermined
}

/** CSS hex colour for UI badges */
export const DECISION_HEX: Record<string, string> = {
  Approved: '#16a34a',
  Refused: '#e00a14',  // sharper, more vivid red
  Undetermined: '#6b7280',
}

export function getDecisionHex(decision: string | null): string {
  if (!decision) return DECISION_HEX.Undetermined
  const d = decision.toLowerCase()
  if (d.includes('approv')) return DECISION_HEX.Approved
  if (d.includes('refus') || d.includes('reject')) return DECISION_HEX.Refused
  return DECISION_HEX.Undetermined
}

export const SUGGESTION_COLORS: Record<SuggestionType, RgbaColor> = {
  troubled_area:    [239, 68,  68,  100],
  opportunity_zone: [245, 158, 11,  80],
  park:             [34,  197, 94,  100],
  housing:          [168, 85,  247, 160],
  bridge:           [59,  130, 246, 200],
  community:        [249, 115, 22,  120],
  mixed_use:        [14,  165, 233, 100],
  transport:        [100, 116, 139, 150],
}

export const SUGGESTION_STROKE_COLORS: Record<SuggestionType, RgbaColor> = {
  troubled_area:    [239, 68,  68,  220],
  opportunity_zone: [245, 158, 11,  220],
  park:             [34,  197, 94,  220],
  housing:          [168, 85,  247, 220],
  bridge:           [59,  130, 246, 255],
  community:        [249, 115, 22,  220],
  mixed_use:        [14,  165, 233, 220],
  transport:        [100, 116, 139, 220],
}

export const SUGGESTION_HEX: Record<SuggestionType, string> = {
  troubled_area:    '#ef4444',
  opportunity_zone: '#f59e0b',
  park:             '#22c55e',
  housing:          '#a855f7',
  bridge:           '#3b82f6',
  community:        '#f97316',
  mixed_use:        '#0ea5e9',
  transport:        '#64748b',
}
