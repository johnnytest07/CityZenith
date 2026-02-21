'use client'

import { SiteHeader } from './SiteHeader'
import { PlanningStats } from './PlanningStats'
import { PrecedentList } from './PrecedentList'
import { ConstraintsSummary } from './ConstraintsSummary'
import { BuiltFormSummary } from './BuiltFormSummary'
import { useSiteStore } from '@/stores/siteStore'

/**
 * The right-side site context panel.
 * Renders when a site is selected. All child components read from SiteContext.
 */
export function SidePanel() {
  const { siteContext, error } = useSiteStore()

  if (!siteContext) return null

  return (
    <div className="flex flex-col h-full">
      <SiteHeader />

      {error && (
        <div className="mx-4 mt-3 bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <PrecedentList />
        <ConstraintsSummary />
        <BuiltFormSummary />
        <PlanningStats />
      </div>
    </div>
  )
}
