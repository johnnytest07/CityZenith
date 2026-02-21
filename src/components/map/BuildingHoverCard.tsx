'use client'

import { useRef } from 'react'
import { useDevStore } from '@/stores/devStore'

/**
 * Floating interactive card shown when hovering the proposed 3D building.
 * Positioned with fixed coords from devStore.hoverInfo.
 * Implements a hide-delay so the card stays visible while the cursor
 * moves from the 3D building to the card itself.
 */
export function BuildingHoverCard() {
  const { hoverInfo, buildRecommendation, switchAlternative, setHoverInfo } = useDevStore()
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (!hoverInfo || !buildRecommendation) return null

  const { primary, alternatives, activeIndex } = buildRecommendation
  const active = activeIndex === 0 ? primary : alternatives[activeIndex - 1]

  const scheduleHide = () => {
    hideTimerRef.current = setTimeout(() => {
      setHoverInfo(null)
    }, 150)
  }

  const cancelHide = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: hoverInfo.x + 14,
        top: hoverInfo.y - 50,
        zIndex: 1000,
        pointerEvents: 'auto',
      }}
      onMouseEnter={cancelHide}
      onMouseLeave={scheduleHide}
      className="bg-gray-900 border border-violet-800/60 rounded-xl shadow-2xl shadow-violet-950/50 p-3 w-56"
    >
      {/* Active option */}
      <div className="mb-2">
        <p className="text-violet-300 text-xs font-semibold leading-tight">{active.buildingType}</p>
        <p className="text-gray-400 text-xs mt-0.5">{active.style}</p>
        <div className="flex gap-3 mt-1.5 text-xs text-gray-500">
          <span>{active.storeys} storeys</span>
          <span>{active.approxFootprintM2}m²</span>
          <span>{active.approxHeightM.toFixed(1)}m</span>
        </div>
      </div>

      {/* Alternative chips */}
      <div className="border-t border-gray-800 pt-2 space-y-1">
        <p className="text-gray-600 text-[10px] uppercase tracking-wide mb-1.5">Alternatives</p>
        {alternatives.map((alt, i) => (
          <button
            key={i}
            onClick={() => switchAlternative(activeIndex === i + 1 ? 0 : i + 1)}
            className={`w-full text-left text-xs px-2 py-1 rounded transition-colors ${
              activeIndex === i + 1
                ? 'bg-violet-800/50 text-violet-200'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
          >
            {alt.buildingType}
          </button>
        ))}
      </div>

      {/* Recommended button — shown when an alternative is active */}
      {activeIndex !== 0 && (
        <button
          onClick={() => switchAlternative(0)}
          className="mt-2 w-full text-xs text-violet-400 hover:text-violet-200 border border-violet-800/40 rounded px-2 py-1 transition-colors"
        >
          ← Recommended
        </button>
      )}
    </div>
  )
}
