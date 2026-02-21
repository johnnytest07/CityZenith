'use client'

import { useDevStore } from '@/stores/devStore'
import { useIdentityStore } from '@/stores/identityStore'
import { useState } from 'react'

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
  }
  const active = buildRecommendation
    ? (activeIndex === 0 ? primary : alternatives[activeIndex - 1])
    : null

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
