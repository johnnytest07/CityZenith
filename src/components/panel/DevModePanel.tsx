"use client";

import type { BuildingOption, RecommendFactor } from "@/types/devMode";
import { useDevStore } from '@/stores/devStore'
import { useIdentityStore } from '@/stores/identityStore'
import { useState } from 'react'

// ─── Factor chip ─────────────────────────────────────────────────────────────

const IMPACT_STYLES: Record<RecommendFactor["impact"], string> = {
  positive: "bg-green-950/60 border-green-800/50 text-green-300",
  neutral: "bg-gray-900    border-gray-700/50   text-gray-400",
  negative: "bg-red-950/60  border-red-800/50    text-red-300",
};

const IMPACT_DOT: Record<RecommendFactor["impact"], string> = {
  positive: "bg-green-400",
  neutral: "bg-gray-500",
  negative: "bg-red-400",
};

function FactorChip({ factor }: { factor: RecommendFactor }) {
  return (
    <div
      className={`flex items-start gap-1.5 border rounded-lg px-2.5 py-2 ${IMPACT_STYLES[factor.impact]}`}
    >
      <span
        className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${IMPACT_DOT[factor.impact]}`}
      />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide opacity-60 leading-none mb-0.5">
          {factor.label}
        </p>
        <p className="text-xs font-medium leading-tight">{factor.value}</p>
      </div>
    </div>
  );
}

// ─── Option card (primary + alternatives) ────────────────────────────────────

function OptionCard({
  option,
  footprintM2,
  isActive,
  isRecommended,
  onClick,
}: {
  option: BuildingOption;
  footprintM2: number | null;
  isActive: boolean;
  isRecommended: boolean;
  onClick?: () => void;
}) {
  const displayFootprint =
    footprintM2 != null ? Math.round(footprintM2) : option.approxFootprintM2;

  const cardClass = isActive
    ? "border-violet-600/70 bg-violet-950/30"
    : isRecommended
      ? "border-violet-800/40 bg-violet-950/10 opacity-60"
      : "border-gray-800 bg-gray-900/60 hover:border-gray-700";

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      className={`rounded-xl border transition-all ${
        onClick ? "cursor-pointer" : ""
      } ${cardClass}`}
    >
      {/* Card header */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-semibold text-white leading-tight">
            {option.buildingType}
          </p>
          {isRecommended && (
            <span className="shrink-0 text-[10px] font-semibold bg-violet-700/60 text-violet-200 border border-violet-600/40 px-1.5 py-0.5 rounded-full">
              Recommended
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">{option.style}</p>

        {/* Stat row */}
        <div className="flex gap-3 mt-2">
          <StatPill icon="↑" value={`${option.storeys} storeys`} />
          <StatPill icon="⬛" value={`${displayFootprint}m²`} />
          <StatPill icon="◆" value={`${option.approxHeightM.toFixed(1)}m`} />
        </div>
      </div>

      {/* Reasoning */}
      <div className="px-3 pb-2 border-t border-gray-800/60 pt-2">
        <ul className="space-y-1">
          {(Array.isArray(option.reasoning)
            ? option.reasoning
            : [option.reasoning]
          ).map((point, i) => (
            <li
              key={i}
              className="text-xs text-gray-400 leading-relaxed flex gap-1.5"
            >
              <span className="text-gray-500 shrink-0 mt-0.5">•</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Factors */}
      {option.factors.length > 0 && (
        <div className="px-3 pb-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-1">
            Influencing factors
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {option.factors.map((f, i) => (
              <FactorChip key={i} factor={f} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatPill({ icon, value }: { icon: string; value: string }) {
  return (
    <span className="flex items-center gap-1 text-[11px] text-gray-500">
      <span className="text-gray-700 text-[9px]">{icon}</span>
      {value}
    </span>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

/**
 * Shown at the top of the side panel when build mode is active.
 * Displays step-by-step guidance and the LLM recommendation result.
 */
export function DevModePanel() {
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
  } = useDevStore()
  const { council } = useIdentityStore()
  const [ingestionStatus, setIngestionStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [ingestionError, setIngestionError] = useState<string | null>(null)

  const handleIngest = async () => {
    if (!council) return
    setIngestionStatus('loading')
    setIngestionError(null)
    try {
      const response = await fetch('/api/intelligence/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ council: council.name }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to start ingestion.')
      }
      setIngestionStatus('success')
    } catch (error) {
      setIngestionStatus('error')
      setIngestionError(error instanceof Error ? error.message : 'Unknown error')
    }
  }

  const { activeIndex, primary, alternatives } = buildRecommendation ?? {
    activeIndex: 0,
    primary: null,
    alternatives: [],
  };

  const nodeCount = polygonNodes.length;
  const isCloseable = nodeCount >= 3;

  return (
    <div className="border-b border-gray-800 bg-violet-950/20">
      {/* Intelligence Ingestion */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Council Intelligence</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Ingest planning documents for <b>{council?.name || '...'}</b>
            </p>
          </div>
          <button
            onClick={handleIngest}
            disabled={!council || ingestionStatus === 'loading'}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-violet-600 rounded-md hover:bg-violet-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {ingestionStatus === 'loading' ? 'Ingesting...' : 'Ingest'}
          </button>
        </div>
        {ingestionStatus === 'error' && (
          <p className="text-xs text-red-400 mt-2">Error: {ingestionError}</p>
        )}
        {ingestionStatus === 'success' && (
          <p className="text-xs text-green-400 mt-2">Ingestion pipeline started successfully in the background.</p>
        )}
      </div>

      {/* Header */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">
            Build New
          </span>
          <span className="text-[10px] bg-violet-900/50 text-violet-300 px-1.5 py-0.5 rounded capitalize">
            {buildStep}
          </span>
        </div>

        <div className="space-y-3 mt-2">
        {/* Warnings */}
        {roadWarning && (
          <div className="flex gap-2 bg-amber-950/50 border border-amber-800/50 rounded-lg px-3 py-2">
            <span className="text-amber-400 shrink-0">⚠</span>
            <p className="text-xs text-amber-300">
              No road within 30m — check access routes before proceeding.
            </p>
          </div>
        )}
        {buildError && (
          <div className="flex gap-2 bg-red-950/50 border border-red-800/50 rounded-lg px-3 py-2">
            <span className="text-red-400 shrink-0">✕</span>
            <p className="text-xs text-red-300">{buildError}</p>
          </div>
        )}

        {/* ── Place step ── */}
        {buildStep === "place" && (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="mt-1 w-2 h-2 rounded-full bg-violet-500 shrink-0 animate-pulse" />
              <p className="text-xs text-gray-400 leading-relaxed">
                {nodeCount === 0
                  ? "Click on the map to place polygon nodes. Draw the boundary of your development."
                  : isCloseable
                    ? `${nodeCount} nodes placed — click the first node (yellow) or tap Complete to finish.`
                    : `${nodeCount} node${nodeCount === 1 ? "" : "s"} placed — keep clicking to build your shape.`}
              </p>
            </div>
            <div className="flex gap-2">
              {isCloseable && (
                <button
                  onClick={requestComplete}
                  className="text-xs bg-violet-700 hover:bg-violet-600 text-white px-3 py-1.5 rounded transition-colors"
                >
                  Complete shape
                </button>
              )}
              {nodeCount > 0 && (
                <button
                  onClick={resetToPlace}
                  className="text-xs text-gray-500 hover:text-gray-300 border border-gray-800 rounded px-2 py-1 transition-colors"
                >
                  Clear nodes
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Loading step ── */}
        {buildStep === "loading" && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-violet-400">
              <span className="w-3 h-3 border border-violet-500 border-t-violet-200 rounded-full animate-spin shrink-0" />
              Analysing optimal development for this footprint…
            </div>
            {buildFootprintM2 != null && (
              <p className="text-xs text-gray-600">
                Drawn area: {Math.round(buildFootprintM2)}m²
              </p>
            )}
          </div>
        )}

        {/* ── Result step ── */}
        {buildStep === "result" && primary && (
          <div className="space-y-3">
            {/* Primary is always pinned at the top.
                Dimmed when an alternative is active; click to re-select. */}
            <OptionCard
              option={primary}
              footprintM2={buildFootprintM2}
              isActive={activeIndex === 0}
              isRecommended
              onClick={() => switchAlternative(0)}
            />

            {/* Alternatives */}
            {alternatives.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2">
                  Alternatives
                </p>
                <div className="space-y-2">
                  {alternatives.map((alt, i) => {
                    const altIndex = i + 1;
                    const isSelected = activeIndex === altIndex;
                    return (
                      <OptionCard
                        key={i}
                        option={alt}
                        footprintM2={buildFootprintM2}
                        isActive={isSelected}
                        isRecommended={false}
                        onClick={() =>
                          switchAlternative(isSelected ? 0 : altIndex)
                        }
                      />
                    );
                  })}
                </div>
              </div>
            )}

            <button
              onClick={resetToPlace}
              className="text-xs text-gray-600 hover:text-gray-400 border border-gray-800 rounded px-2 py-1 transition-colors"
            >
              Reset placement
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
