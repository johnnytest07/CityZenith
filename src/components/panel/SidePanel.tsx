"use client";

import { useEffect } from "react";
import { SiteHeader } from "./SiteHeader";
import { PlanningStats } from "./PlanningStats";
import { PrecedentList } from "./PrecedentList";
import { ConstraintsSummary } from "./ConstraintsSummary";
import { BuiltFormSummary } from "./BuiltFormSummary";
import { AmenitiesPanel } from "./AmenitiesPanel";
import { useSiteStore } from "@/stores/siteStore";
import { useInsights } from "@/hooks/useInsights";
import type { InsightItem } from "@/types/insights";

function computeScore(items: InsightItem[]) {
  if (items.length === 0) return null
  const high   = items.filter((i) => i.priority === 'high').length
  const medium = items.filter((i) => i.priority === 'medium').length
  const low    = items.filter((i) => i.priority === 'low').length
  const total  = Math.round((high * 10 + medium * 6 + low * 3) / (items.length * 10) * 100)
  const label  = total >= 70 ? 'High' : total >= 40 ? 'Moderate' : 'Low'
  return { total, label, high, medium, low } as const
}

const SCORE_COLORS = {
  High:     { text: 'text-green-400', bar: 'bg-green-500', badge: 'bg-green-500/15 text-green-400 border-green-500/30' },
  Moderate: { text: 'text-amber-400', bar: 'bg-amber-400', badge: 'bg-amber-400/15 text-amber-400 border-amber-400/30' },
  Low:      { text: 'text-gray-500',  bar: 'bg-gray-600',  badge: 'bg-gray-700/40  text-gray-400  border-gray-600/30'  },
} as const

/**
 * The right-side site context panel.
 * Renders when a site is selected. All child components read from SiteContext.
 *
 * AI insights are auto-triggered here and their bullets are consumed inline
 * by each section card — there is no standalone AI Insights panel.
 */
export function SidePanel() {
  const { siteContext, loadingStates, error } = useSiteStore();
  const { insight, insightsReport, isLoading, generateInsights } = useInsights();

  const score = insightsReport ? computeScore(insightsReport.items) : null

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

      {/* Viability score card — shown while loading and once score is ready */}
      {(isLoading || score) && <div className="shrink-0 px-3 pt-3 pb-1">
        <div className="rounded-xl border border-gray-800 bg-gray-900/80 px-4 py-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="w-3 h-3 rounded-full border border-gray-600 border-t-violet-400 animate-spin shrink-0" />
              Calculating score…
            </div>
          ) : score ? (() => {
            const colors = SCORE_COLORS[score.label]
            return (
              <>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-3xl font-bold tabular-nums leading-none ${colors.text}`}>
                      {score.total}
                    </span>
                    <span className="text-sm text-gray-600 font-medium">/100</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${colors.badge}`}>
                    {score.label} Viability
                  </span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${colors.bar}`}
                    style={{ width: `${score.total}%` }}
                  />
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-500 flex-wrap">
                  <span><span className="text-red-400 font-semibold">{score.high}</span> high</span>
                  <span><span className="text-amber-400 font-semibold">{score.medium}</span> med</span>
                  <span><span className="text-gray-400 font-semibold">{score.low}</span> low</span>
                  <span className="text-gray-700">·</span>
                  <span><span className="text-violet-400 font-semibold">{insightsReport!.items.length}</span> insights</span>
                </div>
              </>
            )
          })() : null}
        </div>
      </div>}

      <div className="flex-1 overflow-y-auto">
        {/* Connectivity always shown first — key context for any development decision */}
        <AmenitiesPanel />

        <PrecedentList />
        <ConstraintsSummary />
        <BuiltFormSummary />
        <PlanningStats />
      </div>
    </div>
  );
}
