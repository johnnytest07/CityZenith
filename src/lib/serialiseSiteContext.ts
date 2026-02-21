import type { SiteContext } from '@/types/siteContext'
import type { ConstraintType } from '@/types/constraints'

/**
 * Serialise a SiteContext into a compact, AI-readable payload.
 *
 * Strips raw GeoJSON geometry — the AI only needs application properties,
 * summary statistics, and pipeline data, not coordinate arrays.
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
  // New fields
  projectType: string | null
  numNewHouses: number | null
  numComments: number | null
  totalUnits: number | null
  affordableUnits: number | null
  unitMixSummary: string | null    // e.g. "1b:4, 2b:5, 3b:2"
  floorAreaAddedSqm: number | null
  appealDecision: string | null
  appealCaseType: string | null
}

export interface SerialisedAmenityLine {
  label: string
  nearest: string
}

export interface SerialisedPipeline {
  councilName: string
  periodYears: number
  totalNewHomesApproved: number
  schemeCount: number
  avgAffordabilityPct: number | null   // % affordable across all schemes with data
  largestSchemes: Array<{ heading: string; units: number; decidedYear: string }>
  projectTypeSplit: string             // e.g. "large residential: 12, medium: 8"
}

export interface SerialisedSiteContext {
  planningStats: {
    totalApplications: number
    outcomeDistributions: Array<{ decision: string; count: number; percentage: number }>
    averageDecisionTimeDays: number | null
    /** Decision time broken down by project type (days) */
    decisionTimeByType: Record<string, number>
    activityLevel: string | null
    newHomesApproved5yr: number | null
  }
  recentApplications: SerialisedApplication[]
  constraints: Partial<Record<ConstraintType, boolean>>
  nearbyContext: {
    buildingCount: number
    landUseTypes: string[]
    heightStats: { min: number; max: number; mean: number; median: number } | null
    queryRadiusM: number
  }
  amenities: SerialisedAmenityLine[]
  pipeline: SerialisedPipeline | null
}

export function serialiseSiteContext(ctx: SiteContext): SerialisedSiteContext {
  const stats = ctx.planningContextStats

  // ── Applications — most recent 15 ──────────────────────────────────────────
  const recentApplications: SerialisedApplication[] = ctx.planningPrecedentFeatures.features
    .map((f) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = (f.properties ?? {}) as Record<string, any>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dm = (p.developer_metrics ?? {}) as Record<string, any>

      // Build bedroom mix summary string
      const beds: string[] = []
      if (p.unit_1bed != null) beds.push(`1b:${p.unit_1bed}`)
      if (p.unit_2bed != null) beds.push(`2b:${p.unit_2bed}`)
      if (p.unit_3bed != null) beds.push(`3b:${p.unit_3bed}`)
      if (p.unit_4plus != null) beds.push(`4b+:${p.unit_4plus}`)
      const unitMixSummary = beds.length > 0 ? beds.join(', ') : null

      return {
        reference:        String(p.planning_reference ?? ''),
        proposal:         String(p.proposal ?? '').slice(0, 200),
        decision:         (p.normalised_decision as string | null) ?? null,
        applicationType:  (p.normalised_application_type as string | null) ?? null,
        receivedDate:     (p.application_date as string | null) ?? null,
        decisionDate:     (p.decided_date as string | null) ?? null,
        complexityScore:  String(dm.complexityScore ?? 'Unknown'),
        isHighValue:      Boolean(dm.isHighValue),
        highValueTags:    Array.isArray(dm.highValueTags) ? dm.highValueTags : [],
        decisionSpeedDays: typeof dm.decisionSpeedDays === 'number' ? dm.decisionSpeedDays : null,
        projectType:      (p.project_type as string | null) ?? null,
        numNewHouses:     typeof p.num_new_houses === 'number' ? p.num_new_houses : null,
        numComments:      typeof p.num_comments_received === 'number' ? p.num_comments_received : null,
        totalUnits:       typeof p.unit_total === 'number' ? p.unit_total : null,
        affordableUnits:  typeof p.unit_affordable === 'number' ? p.unit_affordable : null,
        unitMixSummary,
        floorAreaAddedSqm: typeof p.floor_area_added_sqm === 'number' ? p.floor_area_added_sqm : null,
        appealDecision:   (p.appeal_decision as string | null) ?? null,
        appealCaseType:   (p.appeal_case_type as string | null) ?? null,
      }
    })
    .sort((a, b) => {
      if (!a.decisionDate) return 1
      if (!b.decisionDate) return -1
      return new Date(b.decisionDate).getTime() - new Date(a.decisionDate).getTime()
    })
    .slice(0, 15)

  // ── Constraints ─────────────────────────────────────────────────────────────
  const constraints: Partial<Record<ConstraintType, boolean>> = {}
  for (const [type, state] of Object.entries(ctx.statutoryConstraints)) {
    constraints[type as ConstraintType] = state.intersects
  }

  // ── Nearby built context ────────────────────────────────────────────────────
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

  // ── Council stats ───────────────────────────────────────────────────────────
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

  const decisionTimeByType: Record<string, number> = stats?.average_decision_time
    ? Object.fromEntries(
        Object.entries(stats.average_decision_time).map(([k, v]) => [k, Math.round(v)])
      )
    : {}

  // ── Amenities ───────────────────────────────────────────────────────────────
  const AMENITY_GROUP_DEFS: { label: string; categories: string[] }[] = [
    { label: 'Rail & Tube',  categories: ['train_station', 'subway_station'] },
    { label: 'Bus',          categories: ['bus_stop'] },
    { label: 'Supermarket',  categories: ['supermarket', 'convenience'] },
    { label: 'Gym',          categories: ['gym'] },
    { label: 'Park',         categories: ['park'] },
    { label: 'School',       categories: ['school'] },
    { label: 'Food & Drink', categories: ['restaurant', 'fast_food', 'cafe', 'pub'] },
    { label: 'Pharmacy',     categories: ['pharmacy'] },
  ]

  const amenities: SerialisedAmenityLine[] = AMENITY_GROUP_DEFS
    .map((g) => {
      const matches = (ctx.nearbyAmenities ?? [])
        .filter((a) => g.categories.includes(a.category))
        .slice(0, 2)
      if (matches.length === 0) return null
      const nearest = matches.map((a) => {
        const walkMins = Math.ceil(a.distanceM / 80)
        const subtypeNote = a.subtype ? ` [${a.subtype}]` : ''
        return `${a.name}${subtypeNote} (${a.distanceM}m, ${walkMins} min walk)`
      }).join(', ')
      return { label: g.label, nearest }
    })
    .filter((l): l is SerialisedAmenityLine => l !== null)

  // ── Council pipeline ─────────────────────────────────────────────────────────
  let pipeline: SerialisedPipeline | null = null
  if (ctx.councilPipeline && ctx.councilPipeline.applications.length > 0) {
    const apps = ctx.councilPipeline.applications

    const totalNewHomesApproved = apps.reduce((s, a) => s + (a.num_new_houses ?? 0), 0)

    // Affordability ratio: schemes that have unit mix data
    const appsWithMix = apps.filter((a) => a.proposed_unit_mix?.total_proposed_residential_units != null)
    const avgAffordabilityPct = appsWithMix.length > 0
      ? Math.round(
          appsWithMix
            .map((a) => {
              const total = a.proposed_unit_mix!.total_proposed_residential_units!
              const affordable = a.proposed_unit_mix!.proposed_affordable_units
                ?? a.proposed_unit_mix!.affordable_housing_units
                ?? 0
              return total > 0 ? (affordable / total) * 100 : 0
            })
            .reduce((s, v) => s + v, 0) / appsWithMix.length,
        )
      : null

    // Largest schemes by num_new_houses
    const largest = [...apps]
      .filter((a) => a.num_new_houses != null && a.num_new_houses > 0)
      .sort((a, b) => (b.num_new_houses ?? 0) - (a.num_new_houses ?? 0))
      .slice(0, 3)
      .map((a) => ({
        heading: a.heading ?? a.proposal?.slice(0, 80) ?? 'Unknown',
        units: a.num_new_houses ?? 0,
        decidedYear: a.decided_date?.slice(0, 4) ?? '?',
      }))

    // Project type split
    const typeCounts: Record<string, number> = {}
    for (const a of apps) {
      const t = a.project_type ?? 'unknown'
      typeCounts[t] = (typeCounts[t] ?? 0) + 1
    }
    const projectTypeSplit = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `${t}: ${n}`)
      .join(', ')

    pipeline = {
      councilName: ctx.councilPipeline.councilName,
      periodYears: 2,
      totalNewHomesApproved,
      schemeCount: apps.length,
      avgAffordabilityPct,
      largestSchemes: largest,
      projectTypeSplit,
    }
  }

  return {
    planningStats: {
      totalApplications,
      outcomeDistributions,
      averageDecisionTimeDays,
      decisionTimeByType,
      activityLevel: stats?.council_development_activity_level ?? null,
      newHomesApproved5yr: stats?.number_of_new_homes_approved ?? null,
    },
    recentApplications,
    constraints,
    nearbyContext: {
      buildingCount: ctx.nearbyContextFeatures.buildings.features.length,
      landUseTypes,
      heightStats,
      queryRadiusM: ctx.nearbyContextFeatures.queryRadiusM,
    },
    amenities,
    pipeline,
  }
}
