"use client";

import { useEffect } from "react";
import { SiteHeader } from "./SiteHeader";
import { PlanningStats } from "./PlanningStats";
import { PrecedentList } from "./PrecedentList";
import { ConstraintsSummary } from "./ConstraintsSummary";
import { BuiltFormSummary } from "./BuiltFormSummary";
import { useSiteStore } from "@/stores/siteStore";
import { useInsights } from "@/hooks/useInsights";

/**
 * The right-side site context panel.
 * Renders when a site is selected. All child components read from SiteContext.
 *
 * AI insights are auto-triggered here and their bullets are consumed inline
 * by each section card — there is no standalone AI Insights panel.
 */
export function SidePanel() {
  const { siteContext, loadingStates, error } = useSiteStore();
  const { insight, isLoading, generateInsights } = useInsights();

  // Auto-generate once per site after planning data finishes loading
  useEffect(() => {
    if (!siteContext) return;
    if (insight || isLoading) return;
    if (loadingStates.precedent || loadingStates.stats) return;
    const hasEvidence =
      siteContext.planningPrecedentFeatures.features.length > 0 ||
      siteContext.planningContextStats !== null;
    if (!hasEvidence) return;
    generateInsights(siteContext);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteContext?.siteId, loadingStates.precedent, loadingStates.stats]);

  if (!siteContext) return null;

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
  );
}
