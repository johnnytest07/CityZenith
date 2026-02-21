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

  return {
    planningStats: {
      totalApplications:    stats?.numberOfApplications?.total ?? 0,
      outcomeDistributions: stats?.outcomeDistributions ?? [],
      averageDecisionTimeDays: stats?.averageDecisionTime?.days ?? null,
      activityLevel:        stats?.developmentActivityLevel ?? null,
    },
    recentApplications,
    constraints,
    nearbyContext: {
      buildingCount: ctx.nearbyContextFeatures.buildings.features.length,
      landUseTypes,
    },
  }
}
