import type { InsightCategory } from './siteContext'

export type InsightPriority = 'high' | 'medium' | 'low'

/**
 * A single structured insight card.
 *
 * Gemini generates a detailed analysis first (stored in `detail`),
 * then the `headline` is the punchy summary surfaced on the card face.
 */
export interface InsightItem {
  id: string
  category: InsightCategory
  priority: InsightPriority
  /** One-line headline shown on the card face (max ~12 words) */
  headline: string
  /** 2–4 sentences of detailed, evidence-grounded analysis shown on drill-down */
  detail: string
  /** Data sources the insight is grounded in (e.g. "Local Plan Policy H1", "IBEX planning data") */
  evidenceSources: string[]
}

/**
 * Full structured insights report for a site selection.
 * Contains a narrative summary and an ordered array of insight cards.
 */
export interface InsightsReport {
  /** 2–3 sentence overall assessment tailored to the user's role */
  summary: string
  items: InsightItem[]
  role: 'council' | 'developer'
  council: string
  generatedAt: string
}
