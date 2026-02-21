'use client'

import { useDevStore } from '@/stores/devStore'

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
    setBuildStep,
    switchAlternative,
  } = useDevStore()

  const { activeIndex, primary, alternatives } = buildRecommendation ?? {
    activeIndex: 0,
    primary: null,
    alternatives: [],
  }
  const active = buildRecommendation
    ? (activeIndex === 0 ? primary : alternatives[activeIndex - 1])
    : null

  return (
    <div className="border-b border-gray-800 bg-violet-950/20">
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

        {/* Road warning */}
        {roadWarning && (
          <div className="mb-2 flex gap-2 bg-amber-950/50 border border-amber-800/50 rounded-lg px-3 py-2">
            <span className="text-amber-400 shrink-0">⚠</span>
            <p className="text-xs text-amber-300">No road within 30m — check access routes before proceeding.</p>
          </div>
        )}

        {/* Build error */}
        {buildError && (
          <div className="mb-2 flex gap-2 bg-red-950/50 border border-red-800/50 rounded-lg px-3 py-2">
            <span className="text-red-400 shrink-0">✕</span>
            <p className="text-xs text-red-300">{buildError}</p>
          </div>
        )}

        {/* Place step */}
        {buildStep === 'place' && (
          <div className="flex items-start gap-2">
            <span className="mt-0.5 w-2 h-2 rounded-full bg-violet-500 shrink-0 animate-pulse" />
            <p className="text-xs text-gray-400 leading-relaxed">
              Click within the site to place your development. Existing buildings are blocked.
            </p>
          </div>
        )}

        {/* Loading step */}
        {buildStep === 'loading' && (
          <div className="flex items-center gap-2 text-xs text-violet-400">
            <span className="w-3 h-3 border border-violet-500 border-t-violet-200 rounded-full animate-spin shrink-0" />
            Analysing optimal development for this location…
          </div>
        )}

        {/* Result step */}
        {buildStep === 'result' && active && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-white">{active.buildingType}</p>
              <p className="text-xs text-gray-400 mt-0.5">{active.style}</p>
              <div className="flex gap-3 mt-1.5 text-xs text-gray-500">
                <span>{active.storeys} storeys</span>
                <span>{active.approxFootprintM2}m²</span>
                <span>{active.approxHeightM.toFixed(1)}m</span>
              </div>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">{active.reasoning}</p>

            {/* Alternative chips */}
            {alternatives.length > 0 && (
              <div>
                <p className="text-gray-600 text-[10px] uppercase tracking-wide mb-1.5">Alternatives</p>
                <div className="space-y-1">
                  {alternatives.map((alt, i) => (
                    <button
                      key={i}
                      onClick={() => switchAlternative(activeIndex === i + 1 ? 0 : i + 1)}
                      className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${
                        activeIndex === i + 1
                          ? 'bg-violet-800/50 text-violet-200'
                          : 'text-gray-400 bg-gray-900 hover:bg-gray-800 hover:text-gray-200'
                      }`}
                    >
                      {alt.buildingType}
                      <span className="text-gray-600 ml-2 text-[10px]">{alt.style}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeIndex !== 0 && (
              <button
                onClick={() => switchAlternative(0)}
                className="text-xs text-violet-400 hover:text-violet-200 transition-colors"
              >
                ← Back to recommended
              </button>
            )}

            <button
              onClick={() => setBuildStep('place')}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors border border-gray-800 rounded px-2 py-1"
            >
              Reset placement
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
