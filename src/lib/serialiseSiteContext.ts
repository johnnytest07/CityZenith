import type { SiteContext } from '@/types/siteContext'
import type { ConstraintType } from '@/types/constraints'

/**
 * Serialise a SiteContext into a compact, AI-readable payload.
 *
 * This intentionally strips raw GeoJSON geometry — the AI only needs the
 * application properties and summary statistics, not coordinate arrays.
 */
export interface SerialisedApplication {
  reference: string
  proposal: string
  decision: string | null
  applicationType: string | null
  receivedDate: string | null
  decisionDate: string | null
  complexityScore: string
  isHighValue: boolean
  highValueTags: string[]
  decisionSpeedDays: number | null
}

export interface SerialisedSiteContext {
  planningStats: {
    totalApplications: number
    outcomeDistributions: Array<{ decision: string; count: number; percentage: number }>
    averageDecisionTimeDays: number | null
    activityLevel: string | null
  }
  recentApplications: SerialisedApplication[]
  constraints: Partial<Record<ConstraintType, boolean>>
  nearbyContext: {
    buildingCount: number
    landUseTypes: string[]
    heightStats: { min: number; max: number; mean: number; median: number } | null
    queryRadiusM: number
  }
}

export function serialiseSiteContext(ctx: SiteContext): SerialisedSiteContext {
  // ── Planning stats ──────────────────────────────────────────────────────
  const stats = ctx.planningContextStats

  // ── Applications — most recent 15, truncated proposals ─────────────────
  const recentApplications: SerialisedApplication[] = ctx.planningPrecedentFeatures.features
    .map((f) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = (f.properties ?? {}) as Record<string, any>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dm = (p.developer_metrics ?? {}) as Record<string, any>
      return {
        reference:        String(p.planning_reference ?? ''),
        proposal:         String(p.proposal ?? '').slice(0, 200),
        decision:         (p.normalised_decision as string | null) ?? null,
        applicationType:  (p.normalised_application_type as string | null) ?? null,
        receivedDate:     (p.received_date as string | null) ?? null,
        decisionDate:     (p.decision_date as string | null) ?? null,
        complexityScore:  String(dm.complexityScore ?? 'Unknown'),
        isHighValue:      Boolean(dm.isHighValue),
        highValueTags:    Array.isArray(dm.highValueTags) ? dm.highValueTags : [],
        decisionSpeedDays: typeof dm.decisionSpeedDays === 'number' ? dm.decisionSpeedDays : null,
      }
    })
    .sort((a, b) => {
      if (!a.decisionDate) return 1
      if (!b.decisionDate) return -1
      return new Date(b.decisionDate).getTime() - new Date(a.decisionDate).getTime()
    })
    .slice(0, 15)

  // ── Constraints ─────────────────────────────────────────────────────────
  const constraints: Partial<Record<ConstraintType, boolean>> = {}
  for (const [type, state] of Object.entries(ctx.statutoryConstraints)) {
    constraints[type as ConstraintType] = state.intersects
  }

  // ── Nearby built context ────────────────────────────────────────────────
  const landUseTypes = [
    ...new Set(
      ctx.nearbyContextFeatures.landuse.features
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((f) => ((f.properties ?? {}) as Record<string, any>).landuse as string | undefined)
        .filter((v): v is string => typeof v === 'string' && v.length > 0),
    ),
  ]

  const buildingHeights: number[] = ctx.nearbyContextFeatures.buildings.features
    .map((f) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = (f.properties ?? {}) as Record<string, any>
      const h = p.render_height ?? p.height ?? p.building_height
      const n = typeof h === 'number' ? h : typeof h === 'string' ? parseFloat(h) : NaN
      return n
    })
    .filter((h) => !isNaN(h) && h > 0)
    .sort((a, b) => a - b)

  const heightStats = buildingHeights.length > 0
    ? {
        min:    Math.round(buildingHeights[0] * 10) / 10,
        max:    Math.round(buildingHeights[buildingHeights.length - 1] * 10) / 10,
        mean:   Math.round((buildingHeights.reduce((s, h) => s + h, 0) / buildingHeights.length) * 10) / 10,
        median: Math.round(buildingHeights[Math.floor(buildingHeights.length / 2)] * 10) / 10,
      }
    : null

  // ── Council stats — map snake_case IBEX fields to serialised shape ──────
  const totalApplications = stats?.number_of_applications
    ? Object.values(stats.number_of_applications).reduce((sum, n) => sum + n, 0)
    : 0

  const outcomeDistributions: Array<{ decision: string; count: number; percentage: number }> = []
  if (stats?.approval_rate != null)
    outcomeDistributions.push({ decision: 'Approved', count: 0, percentage: stats.approval_rate * 100 })
  if (stats?.refusal_rate != null)
    outcomeDistributions.push({ decision: 'Refused', count: 0, percentage: stats.refusal_rate * 100 })

  const averageDecisionTimeDays: number | null = (() => {
    if (!stats?.average_decision_time) return null
    const values = Object.values(stats.average_decision_time)
    if (values.length === 0) return null
    return Math.round(values.reduce((s, v) => s + v, 0) / values.length)
  })()

  return {
    planningStats: {
      totalApplications,
      outcomeDistributions,
      averageDecisionTimeDays,
      activityLevel: stats?.council_development_activity_level ?? null,
    },
    recentApplications,
    constraints,
    nearbyContext: {
      buildingCount: ctx.nearbyContextFeatures.buildings.features.length,
      landUseTypes,
      heightStats,
      queryRadiusM: ctx.nearbyContextFeatures.queryRadiusM,
    },
  }
}
