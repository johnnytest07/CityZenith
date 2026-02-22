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

import type { SuggestionType } from '@/types/council'

export const SUGGESTION_COLORS: Record<SuggestionType, RgbaColor> = {
  troubled_area:    [220,  50,  50, 130],
  opportunity_zone: [ 50, 200, 100, 130],
  park:             [ 50, 180,  80, 120],
  housing:          [100, 150, 240, 130],
  bridge:           [200, 180,  60, 130],
  community:        [180, 100, 220, 120],
  mixed_use:        [240, 160,  40, 130],
  transport:        [ 80, 200, 240, 120],
}

export const SUGGESTION_STROKE_COLORS: Record<SuggestionType, RgbaColor> = {
  troubled_area:    [255,  80,  80, 200],
  opportunity_zone: [ 80, 230, 130, 200],
  park:             [ 80, 210, 110, 200],
  housing:          [140, 180, 255, 200],
  bridge:           [230, 210,  80, 200],
  community:        [210, 130, 255, 200],
  mixed_use:        [255, 190,  70, 200],
  transport:        [110, 230, 255, 200],
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
