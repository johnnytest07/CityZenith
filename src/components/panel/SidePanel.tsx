"use client";

import { useEffect } from "react";
import { SiteHeader } from "./SiteHeader";
import { PlanningStats } from "./PlanningStats";
import { PrecedentList } from "./PrecedentList";
import { ConstraintsSummary } from "./ConstraintsSummary";
import { BuiltFormSummary } from "./BuiltFormSummary";
import { AmenitiesPanel } from "./AmenitiesPanel";
import { DevModePanel } from "./DevModePanel";
import { useSiteStore } from "@/stores/siteStore";
import { useDevStore } from "@/stores/devStore";
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
  const { buildMode } = useDevStore();

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
  }, [
    siteContext?.siteId,
    loadingStates.precedent,
    loadingStates.stats,
    generateInsights,
    insight,
    isLoading,
  ]);

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
        {/* Connectivity always shown first — key context for any development decision */}
        <AmenitiesPanel />

        {/* Build mode recommendation — shown above planning history when active */}
        {buildMode === "new" && <DevModePanel />}

        <PrecedentList />
        <ConstraintsSummary />
        <BuiltFormSummary />
        <PlanningStats />
      </div>
    </div>
  );
}
