"use client";

import { useState } from "react";
import type { PlanningContextStats } from "@/types/ibex";
import { useSiteStore } from "@/stores/siteStore";
import { SectionCard } from "./SectionCard";
import { InsightCallout } from "./InsightCallout";

export function PlanningStats() {
  const { siteContext, loadingStates, insightBullets, insightLoading } =
    useSiteStore();
  const [expanded, setExpanded] = useState(false);

  const councilBullets =
    insightBullets?.filter((b) => b.category === "council").map((b) => b.text) ?? [];

  const stats: PlanningContextStats | null =
    siteContext?.planningContextStats ?? null;

  const councilName =
    siteContext?.planningPrecedentFeatures?.features.find(
      (f) => f.properties?.council_name,
    )?.properties?.council_name ?? null;

  if (loadingStates.stats) {
    return (
      <SectionCard
        title="Council Context"
        scope={councilName ?? undefined}
        summary={
          <span className="text-xs text-gray-700 animate-pulse">Loading…</span>
        }
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
      >
        <div className="space-y-3 mt-2">
          <div className="h-5 w-20 bg-gray-800 rounded animate-pulse" />
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3 w-20 bg-gray-800 rounded animate-pulse" />
                <div className="h-3 w-10 bg-gray-800 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </SectionCard>
    );
  }

  if (!stats) {
    return (
      <SectionCard
        title="Council Context"
        scope={councilName ?? undefined}
        summary={
          <span className="text-xs text-gray-600">No data available</span>
        }
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
      >
        <p className="text-gray-600 text-xs mt-2">
          No statistical data available for this site.
        </p>
        <InsightCallout
          texts={councilBullets}
          isLoading={insightLoading && councilBullets.length === 0}
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Council Context"
      scope={councilName ?? undefined}
      summary={
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
          {stats.council_development_activity_level && (
            <>
              <span className="text-indigo-400 capitalize font-medium">
                {stats.council_development_activity_level}
              </span>
              <span className="text-gray-600">activity</span>
            </>
          )}
          {stats.approval_rate != null && (
            <>
              <span className="text-gray-700 mx-0.5">·</span>
              <span className="text-green-400 tabular-nums font-medium">
                {(stats.approval_rate * 100).toFixed(0)}%
              </span>
              <span className="text-gray-600">approval</span>
            </>
          )}
          {stats.number_of_new_homes_approved != null &&
            stats.number_of_new_homes_approved > 0 && (
              <>
                <span className="text-gray-700 mx-0.5">·</span>
                <span className="text-gray-300 tabular-nums font-medium">
                  {stats.number_of_new_homes_approved.toLocaleString()}
                </span>
                <span className="text-gray-600">homes</span>
              </>
            )}
        </div>
      }
      expanded={expanded}
      onToggle={() => setExpanded((e) => !e)}
    >
      <div className="mt-2">
        {/* Activity level */}
        {stats.council_development_activity_level && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-gray-500 text-xs">Activity</span>
            <span className="inline-block bg-indigo-950/60 border border-indigo-800/50 text-indigo-300 text-xs px-2 py-0.5 rounded-full font-medium capitalize">
              {stats.council_development_activity_level}
            </span>
          </div>
        )}

        {/* Approval / refusal rates */}
        {(stats.approval_rate != null || stats.refusal_rate != null) && (
          <div className="mb-4">
            <p className="text-gray-600 text-xs uppercase tracking-wide mb-2">
              Outcome rates
            </p>
            <div className="space-y-1.5">
              {stats.approval_rate != null && (
                <RateRow
                  label="Approval"
                  value={stats.approval_rate}
                  color="bg-green-500"
                  textColor="text-green-400"
                />
              )}
              {stats.refusal_rate != null && (
                <RateRow
                  label="Refusal"
                  value={stats.refusal_rate}
                  color="bg-red-500"
                  textColor="text-red-400"
                />
              )}
            </div>
          </div>
        )}

        {/* Applications by type */}
        {stats.number_of_applications &&
          Object.keys(stats.number_of_applications).length > 0 && (
            <CollapsibleList
              title="Applications by type"
              entries={Object.entries(stats.number_of_applications)
                .filter(([, v]) => v > 0)
                .sort(([, a], [, b]) => b - a)}
              renderValue={(v) => v.toLocaleString()}
              maxVisible={5}
            />
          )}

        {/* Average decision time */}
        {stats.average_decision_time &&
          Object.keys(stats.average_decision_time).length > 0 && (
            <CollapsibleList
              title="Avg. decision time"
              entries={Object.entries(stats.average_decision_time)
                .filter(([, v]) => v > 0)
                .sort(([, a], [, b]) => b - a)}
              renderValue={(v) => `${Math.round(v)}d`}
              maxVisible={4}
            />
          )}

        {/* New homes approved */}
        {stats.number_of_new_homes_approved != null &&
          stats.number_of_new_homes_approved > 0 && (
            <div className="mt-1 pt-3 border-t border-gray-800">
              <p className="text-gray-600 text-xs uppercase tracking-wide mb-1">
                New homes approved
              </p>
              <span className="text-xl font-bold text-white tabular-nums">
                {stats.number_of_new_homes_approved.toLocaleString()}
              </span>
            </div>
          )}

        <InsightCallout
          texts={councilBullets}
          isLoading={insightLoading && councilBullets.length === 0}
        />
      </div>
    </SectionCard>
  );
}

function RateRow({
  label,
  value,
  color,
  textColor,
}: {
  label: string;
  value: number;
  color: string;
  textColor: string;
}) {
  const pct = (value * 100).toFixed(1);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className={`font-semibold tabular-nums ${textColor}`}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${Math.min(value * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

function CollapsibleList({
  title,
  entries,
  renderValue,
  maxVisible,
}: {
  title: string;
  entries: [string, number][];
  renderValue: (v: number) => string;
  maxVisible: number;
}) {
  const [listExpanded, setListExpanded] = useState(false);
  const visible = listExpanded ? entries : entries.slice(0, maxVisible);
  const hidden = entries.length - maxVisible;

  return (
    <div className="mb-4">
      <p className="text-gray-600 text-xs uppercase tracking-wide mb-2">
        {title}
      </p>
      <div className="space-y-1">
        {visible.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <span className="text-gray-400 truncate capitalize">
              {label.replace(/_/g, " ")}
            </span>
            <span className="text-gray-200 tabular-nums font-medium flex-shrink-0">
              {renderValue(value)}
            </span>
          </div>
        ))}
      </div>
      {hidden > 0 && (
        <button
          onClick={() => setListExpanded((e) => !e)}
          className="mt-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          {listExpanded ? "↑ Show less" : `↓ ${hidden} more`}
        </button>
      )}
    </div>
  );
}
