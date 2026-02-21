"use client";

import { useState } from "react";
import { useSiteStore } from "@/stores/siteStore";
import { getDecisionHex } from "@/lib/colors";
import { SectionCard } from "./SectionCard";
import { InsightCallout } from "./InsightCallout";

/**
 * Reads planningPrecedentFeatures (raw GeoJSON) from SiteContext.
 * Computes counts and filters AT RENDER-TIME ONLY — nothing stored.
 */
export function PrecedentList() {
  const {
    siteContext,
    loadingStates,
    insightBullets,
    insightLoading,
    setHoveredPrecedentId,
  } = useSiteStore();
  const [expanded, setExpanded] = useState(false);

  const insightBullet =
    insightBullets?.find((b) => b.category === "planning") ?? null;

  if (loadingStates.precedent) {
    return (
      <SectionCard
        title="Site Applications"
        scope="100m radius"
        summary={
          <span className="text-xs text-gray-700 animate-pulse">Loading…</span>
        }
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
      >
        <div className="space-y-2 mt-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-gray-900 border border-gray-800 rounded-lg p-3 space-y-2 animate-pulse"
            >
              <div className="flex justify-between">
                <div className="h-3 w-24 bg-gray-700 rounded" />
                <div className="h-3 w-16 bg-gray-700 rounded" />
              </div>
              <div className="h-3 w-full bg-gray-800 rounded" />
              <div className="h-3 w-2/3 bg-gray-800 rounded" />
            </div>
          ))}
        </div>
      </SectionCard>
    );
  }

  const features = siteContext?.planningPrecedentFeatures?.features ?? [];

  if (features.length === 0) {
    return (
      <SectionCard
        title="Site Applications"
        scope="100m radius"
        summary={
          <span className="text-xs text-gray-600">No applications found</span>
        }
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
      >
        <p className="text-gray-600 text-xs mt-2">
          No planning applications found for this site.
        </p>
        <InsightCallout
          text={insightBullet?.text ?? null}
          isLoading={insightLoading && !insightBullet}
        />
      </SectionCard>
    );
  }

  // ---- Render-time computation only ----
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  let approvedCount = 0;
  let refusedCount = 0;
  let recentCount = 0;

  for (const f of features) {
    const d = (f.properties?.normalised_decision ?? "").toLowerCase();
    if (d.includes("approv")) approvedCount++;
    else if (d.includes("refus") || d.includes("reject")) refusedCount++;

    if (f.properties?.decided_date) {
      const dt = new Date(f.properties.decided_date);
      if (!isNaN(dt.getTime()) && dt >= twoYearsAgo) recentCount++;
    }
  }
  // --------------------------------------

  const sorted = [...features].sort((a, b) => {
    const da = a.properties?.decided_date ?? "";
    const db = b.properties?.decided_date ?? "";
    return db.localeCompare(da);
  });

  return (
    <SectionCard
      title="Site Applications"
      scope="100m radius"
      summary={
        <div className="flex items-center gap-1.5 text-xs flex-wrap">
          <span className="font-semibold text-gray-300 tabular-nums">
            {features.length}
          </span>
          <span className="text-gray-600">total</span>
          <span className="text-gray-700 mx-0.5">·</span>
          <span className="font-semibold text-green-500 tabular-nums">
            {approvedCount}
          </span>
          <span className="text-gray-600">approved</span>
          <span className="text-gray-700 mx-0.5">·</span>
          <span className="font-semibold text-red-500 tabular-nums">
            {refusedCount}
          </span>
          <span className="text-gray-600">refused</span>
          {recentCount > 0 && (
            <>
              <span className="text-gray-700 mx-0.5">·</span>
              <span className="font-semibold text-gray-400 tabular-nums">
                {recentCount}
              </span>
              <span className="text-gray-600">recent</span>
            </>
          )}
        </div>
      }
      expanded={expanded}
      onToggle={() => setExpanded((e) => !e)}
    >
      <div className="space-y-2 mt-2 max-h-80 overflow-y-auto pr-1">
        {sorted.map((feature, idx) => {
          const p = feature.properties ?? {};
          const decision = p.normalised_decision ?? p.decision ?? null;
          const isBuffered = p.geometrySource === "buffered-centroid";
          const decisionDate = p.decided_date
            ? new Date(p.decided_date).toLocaleDateString("en-GB", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : null;

          return (
            <div
              key={p.planning_reference ?? idx}
              className="bg-gray-900 border border-gray-800 rounded-lg p-3 transition-colors hover:border-violet-800/60 cursor-default"
              onMouseEnter={() =>
                p.planning_reference &&
                setHoveredPrecedentId(p.planning_reference)
              }
              onMouseLeave={() => setHoveredPrecedentId(null)}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-mono text-gray-500 text-xs">
                  {p.planning_reference}
                </span>
                {decision && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                    style={{
                      backgroundColor: `${getDecisionHex(decision)}22`,
                      color: getDecisionHex(decision),
                    }}
                  >
                    {decision}
                  </span>
                )}
              </div>

              {p.proposal && (
                <p className="text-gray-400 text-xs leading-relaxed mb-1">
                  {p.proposal}
                </p>
              )}

              <div className="flex items-center gap-2 text-gray-600 text-xs">
                {p.normalised_application_type && (
                  <span className="bg-gray-800 px-1.5 py-0.5 rounded">
                    {p.normalised_application_type}
                  </span>
                )}
                {decisionDate && <span>{decisionDate}</span>}
                {isBuffered && (
                  <span className="text-yellow-700 ml-auto">
                    centroid approx.
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <InsightCallout
        text={insightBullet?.text ?? null}
        isLoading={insightLoading && !insightBullet}
      />
    </SectionCard>
  );
}
