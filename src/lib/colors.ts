/** RGBA colour tuples for deck.gl layers */
export type RgbaColor = [number, number, number, number]

export const DECISION_COLORS: Record<string, RgbaColor> = {
  Approved: [34, 197, 94, 200],     // green-500
  Refused: [239, 68, 68, 200],      // red-500
  Undetermined: [156, 163, 175, 200], // grey-400
}

export const DECISION_STROKE_COLORS: Record<string, RgbaColor> = {
  Approved: [22, 163, 74, 255],     // green-600
  Refused: [220, 38, 38, 255],      // red-600
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
  Refused: '#dc2626',
  Undetermined: '#6b7280',
}

export function getDecisionHex(decision: string | null): string {
  if (!decision) return DECISION_HEX.Undetermined
  const d = decision.toLowerCase()
  if (d.includes('approv')) return DECISION_HEX.Approved
  if (d.includes('refus') || d.includes('reject')) return DECISION_HEX.Refused
  return DECISION_HEX.Undetermined
}
