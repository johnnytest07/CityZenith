"use client";

import type { BuildingOption, RecommendFactor } from "@/types/devMode";
import { useDevStore } from "@/stores/devStore";

// ─── Impact dot ──────────────────────────────────────────────────────────────

const IMPACT_DOT: Record<RecommendFactor["impact"], string> = {
  positive: "bg-green-400",
  neutral: "bg-gray-500",
  negative: "bg-red-400",
};

const IMPACT_TEXT: Record<RecommendFactor["impact"], string> = {
  positive: "text-green-300",
  neutral: "text-gray-400",
  negative: "text-red-300",
};

function FactorRow({ factor }: { factor: RecommendFactor }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-800/50 last:border-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${IMPACT_DOT[factor.impact]}`}
        />
        <span className="text-[11px] text-gray-500 truncate">
          {factor.label}
        </span>
      </div>
      <span
        className={`text-[11px] font-medium shrink-0 ${IMPACT_TEXT[factor.impact]}`}
      >
        {factor.value}
      </span>
    </div>
  );
}

// ─── Stat pill ───────────────────────────────────────────────────────────────

function StatPill({ icon, value }: { icon: string; value: string }) {
  return (
    <span className="flex items-center gap-1 text-[11px] text-gray-400">
      <span className="text-gray-600 text-[9px]">{icon}</span>
      {value}
    </span>
  );
}

// ─── Alternative row ─────────────────────────────────────────────────────────

function AltRow({
  option,
  isActive,
  onClick,
}: {
  option: BuildingOption;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
        isActive
          ? "border-violet-600/50 bg-violet-950/25"
          : "border-gray-800 bg-gray-900/40 hover:border-gray-700"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-200 truncate leading-snug">
            {option.buildingType}
          </p>
          <p className="text-[10px] text-gray-600 truncate">{option.style}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-[11px] text-gray-500">
          <span>↑ {option.storeys}s</span>
          <span>◆ {option.approxHeightM.toFixed(1)}m</span>
        </div>
      </div>

      {/* Expanded detail when active */}
      {isActive && (
        <div className="mt-2 pt-2 border-t border-gray-800/60 space-y-1">
          <ul className="space-y-0.5 mb-1">
            {option.reasoning.map((point, i) => (
              <li
                key={i}
                className="text-[11px] text-gray-400 leading-relaxed flex gap-1.5"
              >
                <span className="text-gray-600 shrink-0 mt-0.5">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
          {option.factors.slice(0, 3).map((f, i) => (
            <FactorRow key={i} factor={f} />
          ))}
        </div>
      )}
    </button>
  );
}

// ─── Main BuildPanel ──────────────────────────────────────────────────────────

/**
 * Left sidebar shown when build mode is active.
 * Drawing guidance → AI recommendation → compact alternatives list.
 */
export function BuildPanel() {
  const {
    buildStep,
    buildRecommendation,
    buildError,
    roadWarning,
    buildFootprintM2,
    polygonNodes,
    resetToPlace,
    requestComplete,
    switchAlternative,
    deactivateBuild,
  } = useDevStore();

  const { activeIndex, primary, alternatives } = buildRecommendation ?? {
    activeIndex: 0,
    primary: null,
    alternatives: [],
  };

  const active = buildRecommendation
    ? activeIndex === 0
      ? primary
      : alternatives[activeIndex - 1]
    : null;

  const nodeCount = polygonNodes.length;
  const isCloseable = nodeCount >= 3;
  const displayFootprint =
    buildFootprintM2 != null
      ? Math.round(buildFootprintM2)
      : (active?.approxFootprintM2 ?? null);

  return (
    <div className="flex flex-col h-full bg-gray-950 border-r border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">
            Build New
          </span>
          {buildStep !== "idle" && buildStep !== "result" && (
            <span className="text-[10px] capitalize text-violet-300/50">
              {buildStep}
            </span>
          )}
        </div>
        <button
          onClick={deactivateBuild}
          className="text-gray-600 hover:text-gray-300 transition-colors text-lg leading-none"
          title="Exit build mode"
        >
          ×
        </button>
      </div>

      {/* Alerts */}
      <div className="px-3 pt-3 space-y-2 shrink-0">
        {roadWarning && (
          <div className="flex gap-2 bg-amber-950/40 border border-amber-800/40 rounded-lg px-3 py-2">
            <span className="text-amber-400 shrink-0 text-sm">⚠</span>
            <p className="text-[11px] text-amber-300 leading-snug">
              No road within 30m — check access before proceeding.
            </p>
          </div>
        )}
        {buildError && (
          <div className="flex gap-2 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
            <span className="text-red-400 shrink-0 text-sm">✕</span>
            <p className="text-[11px] text-red-300 leading-snug">
              {buildError}
            </p>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-3 mt-3">
        {/* ── Place step ── */}
        {buildStep === "place" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 leading-relaxed">
              {nodeCount === 0
                ? "Click on the map to draw the boundary of your proposed development."
                : isCloseable
                  ? `${nodeCount} nodes placed — click the first node or tap Complete.`
                  : `${nodeCount} node${nodeCount === 1 ? "" : "s"} placed — keep clicking.`}
            </p>
            <div className="flex gap-2">
              {isCloseable && (
                <button
                  onClick={requestComplete}
                  className="text-xs bg-violet-700 hover:bg-violet-600 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  Complete shape
                </button>
              )}
              {nodeCount > 0 && (
                <button
                  onClick={resetToPlace}
                  className="text-xs text-gray-500 hover:text-gray-300 border border-gray-800 rounded-lg px-2.5 py-1.5 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Loading step ── */}
        {buildStep === "loading" && (
          <div className="flex items-center gap-2 text-xs text-violet-400 py-2">
            <span className="w-3 h-3 border border-violet-500 border-t-violet-200 rounded-full animate-spin shrink-0" />
            Analysing site…
          </div>
        )}

        {/* ── Result step ── */}
        {buildStep === "result" && active && primary && (
          <div className="space-y-3">
            {/* Primary card */}
            <div
              onClick={() => switchAlternative(0)}
              className={`rounded-xl border overflow-hidden transition-colors cursor-pointer ${activeIndex === 0 ? "border-violet-600/50 bg-violet-950/20" : "border-gray-800 bg-gray-900/40 hover:border-gray-700"}`}
            >
              {/* Card header */}
              <div className="px-3 pt-3 pb-2">
                <div className="flex items-start justify-between gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-white leading-tight">
                    {primary.buildingType}
                  </p>
                  <span
                    className={`shrink-0 text-[9px] font-bold border px-1.5 py-0.5 rounded-full uppercase tracking-wide transition-colors ${activeIndex === 0 ? "bg-violet-700/50 text-violet-200 border-violet-600/30" : "bg-gray-800 text-gray-500 border-gray-700"}`}
                  >
                    Recommended
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mb-2">
                  {primary.style}
                </p>

                {/* Stats */}
                <div className="flex gap-3">
                  <StatPill icon="↑" value={`${primary.storeys} storeys`} />
                  {displayFootprint && (
                    <StatPill icon="⬛" value={`${displayFootprint}m²`} />
                  )}
                  <StatPill
                    icon="◆"
                    value={`${primary.approxHeightM.toFixed(1)}m`}
                  />
                </div>
              </div>

              {/* Reasoning + Factors — only when primary is active */}
              {activeIndex === 0 && (
                <>
                  <div className="px-3 pb-2 border-t border-gray-800/50 pt-2">
                    <ul className="space-y-1">
                      {primary.reasoning.map((point, i) => (
                        <li
                          key={i}
                          className="text-[11px] text-gray-400 leading-relaxed flex gap-1.5"
                        >
                          <span className="text-gray-600 shrink-0 mt-0.5">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {primary.factors.length > 0 && (
                    <div className="px-3 pb-3 border-t border-gray-800/50 pt-2">
                      <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-1.5">
                        Influencing factors
                      </p>
                      <div className="space-y-0">
                        {primary.factors.slice(0, 4).map((f, i) => (
                          <FactorRow key={i} factor={f} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Alternatives */}
            {alternatives.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[9px] uppercase tracking-widest text-gray-600 px-0.5">
                  Alternatives
                </p>
                {alternatives.map((alt, i) => {
                  const altIndex = i + 1;
                  const isSelected = activeIndex === altIndex;
                  return (
                    <AltRow
                      key={i}
                      option={alt}
                      isActive={isSelected}
                      onClick={() =>
                        switchAlternative(isSelected ? 0 : altIndex)
                      }
                    />
                  );
                })}
              </div>
            )}

            {/* Reset */}
            <button
              onClick={resetToPlace}
              className="text-[11px] text-gray-600 hover:text-gray-400 border border-gray-800 rounded-lg px-3 py-1.5 transition-colors w-full"
            >
              Reset placement
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
