"use client";

import { useState, useMemo } from "react";
import { SectionCard } from "./SectionCard";
import { useSiteStore } from "@/stores/siteStore";
import { useDevStore } from "@/stores/devStore";
import { useIdentityStore } from "@/stores/identityStore";
import {
  estimateCIL,
  estimateS106Heads,
  formatGBP,
  LOCAL_CIL_RATES,
  MAYORAL_CIL_RATE_GBP_M2,
  type CILUseType,
} from "@/lib/cilRates";
import type { ConstraintType } from "@/types/constraints";

const USE_TYPES: { value: CILUseType; label: string; description: string }[] = [
  {
    value: "residential",
    label: "Residential (C3)",
    description: "Houses, flats, apartments",
  },
  {
    value: "commercial",
    label: "Commercial (E-class)",
    description: "Offices, retail, café",
  },
  {
    value: "other",
    label: "Other / Mixed",
    description: "Community, sui generis, mixed",
  },
];

/**
 * CIL and Section 106 Obligation Estimator.
 * Pure client-side — no API call. CIL is deterministic from rate tables;
 * S106 heads of terms are derived from unit count + active constraints.
 */
export function ObligationEstimator() {
  const { siteContext } = useSiteStore();
  const { buildFootprintM2 } = useDevStore();
  const { council } = useIdentityStore();

  const [expanded, setExpanded] = useState(false);
  const [useType, setUseType] = useState<CILUseType>("residential");
  const [floorAreaStr, setFloorAreaStr] = useState("");
  const [unitCountStr, setUnitCountStr] = useState("");
  const [showS106, setShowS106] = useState(false);

  // Pre-fill floor area from build mode footprint if available
  const suggestedArea =
    buildFootprintM2 != null ? Math.round(buildFootprintM2) : null;

  const floorArea = parseFloat(floorAreaStr) || suggestedArea || 0;
  const unitCount = parseInt(unitCountStr, 10) || 0;

  const councilId = council?.id ?? "other";
  const localRates = LOCAL_CIL_RATES[councilId];
  const hasLocalRates = localRates != null;

  const constraints = siteContext?.statutoryConstraints;
  const activeConstraints: Partial<Record<ConstraintType, boolean>> = {
    "green-belt": constraints?.["green-belt"]?.intersects ?? false,
    "conservation-area":
      constraints?.["conservation-area"]?.intersects ?? false,
    "article-4": constraints?.["article-4"]?.intersects ?? false,
    "flood-risk": constraints?.["flood-risk"]?.intersects ?? false,
  };

  const cil = useMemo(
    () => (floorArea > 0 ? estimateCIL(councilId, useType, floorArea) : null),
    [councilId, useType, floorArea],
  );

  const s106Heads = useMemo(
    () => estimateS106Heads(unitCount, floorArea, activeConstraints),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [unitCount, floorArea, JSON.stringify(activeConstraints)],
  );

  const triggeredHeads = s106Heads.filter((h) => h.triggered);

  // Collapsed summary
  const summary = cil ? (
    <div className="flex items-center gap-2 mt-0.5">
      {cil.total != null ? (
        <span className="text-xs font-semibold text-white">
          {formatGBP(cil.total)} CIL
        </span>
      ) : (
        <span className="text-xs font-semibold text-white">
          {formatGBP(cil.mayoralCIL)} Mayoral CIL
        </span>
      )}
      <span className="text-[10px] text-gray-500">
        · {triggeredHeads.length} S106 obligation
        {triggeredHeads.length !== 1 ? "s" : ""}
      </span>
    </div>
  ) : (
    <span className="text-xs text-gray-600">
      Enter floor area to estimate CIL and S106
    </span>
  );

  return (
    <SectionCard
      title="CIL / S106 Estimator"
      summary={summary}
      expanded={expanded}
      onToggle={() => setExpanded((e) => !e)}
    >
      <div className="space-y-4 mt-1">
        {/* Council context banner */}
        {hasLocalRates ? (
          <div className="text-[10px] text-violet-400 bg-violet-950/40 border border-violet-800/40 rounded-lg px-3 py-2 leading-relaxed">
            <span className="font-semibold">{council?.name}</span> — Local CIL
            rate:{" "}
            {useType === "residential"
              ? `£${localRates!.residential ?? 0}/m²`
              : `£${localRates!.commercial ?? 0}/m²`}{" "}
            + Mayoral CIL £{MAYORAL_CIL_RATE_GBP_M2}/m²
          </div>
        ) : (
          <div className="text-[10px] text-gray-500 bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 leading-relaxed">
            Local CIL rate not available for this council. Mayoral CIL (£
            {MAYORAL_CIL_RATE_GBP_M2}/m²) only.
          </div>
        )}

        {/* Use type */}
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">
            Use type
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {USE_TYPES.map((ut) => (
              <button
                key={ut.value}
                onClick={() => setUseType(ut.value)}
                className={`text-left px-2.5 py-2 rounded-lg border text-[10px] transition-colors leading-tight ${
                  useType === ut.value
                    ? "bg-violet-900/50 border-violet-600/60 text-violet-300"
                    : "bg-gray-800/50 border-gray-700/60 text-gray-500 hover:border-gray-600 hover:text-gray-400"
                }`}
              >
                <div className="font-medium text-[11px]">{ut.label}</div>
                <div className="mt-0.5 opacity-70">{ut.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">
              Floor area (m²)
            </label>
            <input
              type="number"
              min="1"
              value={floorAreaStr}
              onChange={(e) => setFloorAreaStr(e.target.value)}
              placeholder={
                suggestedArea ? `${suggestedArea} (build mode)` : "e.g. 120"
              }
              className="w-full text-xs text-gray-300 placeholder-gray-600 bg-gray-800/70 border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-600/60 focus:ring-1 focus:ring-violet-600/30 transition-colors"
            />
          </div>
          {useType === "residential" && (
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">
                Net new units
              </label>
              <input
                type="number"
                min="0"
                value={unitCountStr}
                onChange={(e) => setUnitCountStr(e.target.value)}
                placeholder="e.g. 12"
                className="w-full text-xs text-gray-300 placeholder-gray-600 bg-gray-800/70 border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-600/60 focus:ring-1 focus:ring-violet-600/30 transition-colors"
              />
            </div>
          )}
        </div>

        {/* CIL breakdown */}
        {cil && floorArea > 0 && (
          <div className="rounded-xl border border-gray-700/60 bg-gray-800/30 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-700/50">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                CIL estimate — {Math.round(floorArea).toLocaleString("en-GB")}{" "}
                m²
              </p>
            </div>
            <div className="divide-y divide-gray-700/40">
              <div className="flex items-center justify-between px-3 py-2.5">
                <div>
                  <p className="text-xs text-gray-300">Mayoral CIL 2</p>
                  <p className="text-[10px] text-gray-600">
                    £{MAYORAL_CIL_RATE_GBP_M2}/m² · all London
                  </p>
                </div>
                <span className="text-xs font-semibold text-gray-200 tabular-nums">
                  {formatGBP(cil.mayoralCIL)}
                </span>
              </div>

              <div className="flex items-center justify-between px-3 py-2.5">
                <div>
                  <p className="text-xs text-gray-300">Local CIL</p>
                  <p className="text-[10px] text-gray-600">
                    {cil.localRateAvailable
                      ? `£${cil.ratePerM2.local ?? 0}/m² · ${council?.name ?? "council"}`
                      : "Rate not available"}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold tabular-nums ${cil.localRateAvailable ? "text-gray-200" : "text-gray-600"}`}
                >
                  {cil.localRateAvailable && cil.localCIL != null
                    ? formatGBP(cil.localCIL)
                    : "—"}
                </span>
              </div>

              <div className="flex items-center justify-between px-3 py-2.5 bg-gray-800/40">
                <p className="text-xs font-semibold text-white">
                  Total CIL liability
                </p>
                <span className="text-sm font-bold text-white tabular-nums">
                  {cil.total != null
                    ? formatGBP(cil.total)
                    : `≥${formatGBP(cil.mayoralCIL)}`}
                </span>
              </div>
            </div>

            {!cil.localRateAvailable && (
              <p className="text-[9px] text-gray-600 px-3 py-2 border-t border-gray-700/50">
                Add local CIL rates for this council to get the full liability.
              </p>
            )}
          </div>
        )}

        {/* S106 heads of terms */}
        {useType === "residential" && (
          <div>
            <button
              onClick={() => setShowS106((s) => !s)}
              className="flex items-center gap-2 w-full text-left"
            >
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                S106 heads of terms
              </span>
              {triggeredHeads.length > 0 && (
                <span className="text-[10px] font-semibold text-amber-400 bg-amber-950/50 border border-amber-800/40 px-1.5 py-0.5 rounded-full">
                  {triggeredHeads.length} likely
                </span>
              )}
              <svg
                className={`w-3 h-3 text-gray-700 ml-auto transition-transform duration-150 ${showS106 ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {showS106 && (
              <div className="mt-2 space-y-2">
                {unitCount === 0 && (
                  <p className="text-[10px] text-gray-600 italic">
                    Enter net unit count above to see obligation triggers.
                  </p>
                )}
                {s106Heads.map((head) => (
                  <div
                    key={head.label}
                    className={`rounded-lg border px-3 py-2.5 ${
                      head.triggered
                        ? "bg-amber-950/30 border-amber-800/40"
                        : "bg-gray-800/30 border-gray-700/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          head.triggered ? "bg-amber-500" : "bg-gray-600"
                        }`}
                      />
                      <span
                        className={`text-[11px] font-semibold ${
                          head.triggered ? "text-amber-300" : "text-gray-500"
                        }`}
                      >
                        {head.label}
                      </span>
                      <span
                        className={`ml-auto text-[9px] font-medium ${
                          head.triggered ? "text-amber-500" : "text-gray-600"
                        }`}
                      >
                        {head.triggered ? "Likely" : "Unlikely"}
                      </span>
                    </div>
                    {head.triggered && (
                      <p className="text-[10px] text-gray-400 leading-relaxed ml-3.5">
                        {head.detail}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-[9px] text-gray-700 leading-tight border-t border-gray-800 pt-2">
          CIL rates current as of February 2026 (Mayoral CIL 2 £60/m²). S106
          obligations are indicative — actual sums are subject to viability
          negotiation with the LPA. This does not constitute financial or
          planning advice.
        </p>
      </div>
    </SectionCard>
  );
}
