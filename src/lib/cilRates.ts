/**
 * CIL (Community Infrastructure Levy) rate tables and S106 heuristics.
 *
 * Rates current as of February 2026:
 *   Mayoral CIL 2 (MCIL2): £60/m² — applies to all London boroughs (GLA).
 *   Local CIL rates vary per LPA; only Royal Greenwich and Enfield are
 *   hardcoded here. Others are flagged as unavailable so only Mayoral CIL
 *   is shown.
 *
 * S106 heads of terms are derived heuristically from unit count and active
 * statutory constraints — they are indicative indicators only, not legal advice.
 *
 * Sources:
 *   MCIL2 — GLA CIL2 charging schedule (effective 1 April 2019, as amended)
 *   Royal Greenwich Local CIL — Charging schedule Zone A/B blended residential rate
 *   Enfield Local CIL — Charging schedule residential rate
 */

import type { ConstraintType } from '@/types/constraints'

/** Mayoral CIL 2 rate (£/m²) — applies to all London boroughs */
export const MAYORAL_CIL_RATE_GBP_M2 = 60

/** Use types eligible for CIL */
export type CILUseType = 'residential' | 'commercial' | 'other'

interface LocalCILRates {
  /** £/m² for C3 residential gross internal area */
  residential: number | null
  /** £/m² for commercial / employment floorspace */
  commercial: number | null
}

/**
 * Local CIL rates keyed by council `id` from SUPPORTED_COUNCILS.
 * null means the rate applies but isn't available — show Mayoral only.
 */
export const LOCAL_CIL_RATES: Record<string, LocalCILRates | null> = {
  'royal-greenwich': { residential: 100, commercial: 0 },
  'enfield': { residential: 55, commercial: 0 },
  'other': null,
}

export interface CILEstimate {
  mayoralCIL: number
  localCIL: number | null
  total: number | null
  /** false when local rate is not known — show Mayoral-only message */
  localRateAvailable: boolean
  ratePerM2: { mayoral: number; local: number | null }
}

/**
 * Estimate CIL liability for given floor area and use type.
 * @param councilId  Council `id` string from identityStore
 * @param useType    'residential' | 'commercial' | 'other'
 * @param floorAreaM2 Gross internal area in m²
 */
export function estimateCIL(
  councilId: string,
  useType: CILUseType,
  floorAreaM2: number,
): CILEstimate {
  const mayoralCIL = MAYORAL_CIL_RATE_GBP_M2 * floorAreaM2
  const localRates = LOCAL_CIL_RATES[councilId] ?? null

  if (!localRates) {
    return {
      mayoralCIL,
      localCIL: null,
      total: null,
      localRateAvailable: false,
      ratePerM2: { mayoral: MAYORAL_CIL_RATE_GBP_M2, local: null },
    }
  }

  const localRate =
    useType === 'residential' ? localRates.residential
    : useType === 'commercial' ? localRates.commercial
    : 0
  const localCIL = localRate != null ? localRate * floorAreaM2 : null

  return {
    mayoralCIL,
    localCIL,
    total: localCIL != null ? mayoralCIL + localCIL : null,
    localRateAvailable: true,
    ratePerM2: { mayoral: MAYORAL_CIL_RATE_GBP_M2, local: localRate },
  }
}

export interface S106HeadOfTerm {
  label: string
  detail: string
  triggered: boolean
}

/**
 * Generate indicative S106 heads of terms based on unit count and site constraints.
 * All items are returned with a `triggered` flag — only triggered ones are
 * typically relevant, but non-triggered items can be shown for educational context.
 *
 * London Plan policy applies (Intend to Publish 2021 + adopted 2021):
 *   - Affordable housing: ≥10 units (net) → 35% on-site target
 *   - Education: any net new residential unit may trigger a contribution
 *   - Transport: ≥10 units or significant commercial → Transport for London / LPA
 *   - Open space / play: ≥10 units residential → GLA / LPA SPD
 *   - Carbon offsetting: all schemes requiring planning permission in London
 */
export function estimateS106Heads(
  unitCount: number,
  floorAreaM2: number,
  constraints: Partial<Record<ConstraintType, boolean>>,
): S106HeadOfTerm[] {
  const sizable = unitCount >= 10

  return [
    {
      label: 'Affordable housing',
      detail: sizable
        ? `London Plan policy H5: 35% of ${unitCount} units = ~${Math.round(unitCount * 0.35)} affordable units (target). May be met on-site or via payment in lieu.`
        : unitCount >= 2
          ? 'Below 10-unit threshold — affordable housing obligation unlikely but LPA may seek commuted sum depending on local policy.'
          : 'Below threshold — no affordable housing obligation.',
      triggered: sizable,
    },
    {
      label: 'Education contribution',
      detail:
        unitCount >= 1
          ? 'LPA may seek a financial contribution toward primary / secondary school places per London Councils formula (typically £2,000–£8,000 per bedroom).'
          : 'No residential units — education contribution unlikely.',
      triggered: unitCount >= 1,
    },
    {
      label: 'Transport / highways',
      detail: sizable
        ? 'LPA / TfL may seek contribution toward public transport improvements, cycle infrastructure, or pedestrian links. A Transport Assessment is likely required.'
        : 'Below 10-unit threshold — minor transport contribution possible depending on LPA SPD.',
      triggered: sizable,
    },
    {
      label: 'Open space / play space',
      detail: sizable
        ? `GLA SPG: minimum 10m² of play space per child for 1–2 bed units; higher for family units. ${floorAreaM2 > 0 ? `Estimated site GIA ${Math.round(floorAreaM2)}m².` : ''} On-site provision or commuted sum.`
        : 'Below threshold — open space contribution unlikely.',
      triggered: sizable,
    },
    {
      label: 'Carbon offsetting',
      detail:
        'London Plan policy SI 2: all major schemes must achieve net zero carbon on-site or offset any residual carbon emissions via the borough carbon offset fund.',
      triggered: unitCount >= 10 || floorAreaM2 >= 1000,
    },
    {
      label: 'Flood risk mitigation',
      detail: constraints['flood-risk']
        ? 'Site is in Flood Zone 3. LPA may require a Flood Risk Assessment and / or a contribution toward flood defence works or a SUDS scheme. Sequential test required.'
        : 'Site does not intersect Flood Risk Zone 3 — no flood mitigation obligation.',
      triggered: !!constraints['flood-risk'],
    },
    {
      label: 'Conservation area management',
      detail: constraints['conservation-area']
        ? 'Conservation Area: LPA may require use of traditionally-matched materials and landscaping. A Heritage Impact Assessment is likely required for any new build or significant alteration.'
        : 'No Conservation Area — no heritage management contribution required.',
      triggered: !!constraints['conservation-area'],
    },
  ]
}

/** Format a number as £ with thousands separator, rounding to nearest £ */
export function formatGBP(value: number): string {
  return `£${Math.round(value).toLocaleString('en-GB')}`
}
