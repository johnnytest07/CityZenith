'use client'

import { useState } from 'react'
import { useCouncilStore } from '@/stores/councilStore'
import { useCouncilAnalysis } from '@/hooks/useCouncilAnalysis'
import { useIdentityStore } from '@/stores/identityStore'
import { useMapStore } from '@/stores/mapStore'
import { StageProgress } from './StageProgress'

const DEFAULT_BOUNDS: [number, number, number, number] = [0.07, 51.47, 0.17, 51.53]

function regionKey(councilName: string): string {
  return councilName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function CouncilAskButton() {
  const { isAnalysing, stages, suggestions, error, clearAnalysis, cachedAt } = useCouncilStore()
  const { startCouncilAnalysis } = useCouncilAnalysis()
  const { council } = useIdentityStore()
  const { bounds } = useMapStore()

  const [expanded, setExpanded] = useState(false)

  const completedStages = stages.filter((s) => s.status === 'complete').length
  const hasResults = suggestions.length > 0

  const handleAsk = async () => {
    if (isAnalysing) return
    setExpanded(true)
    clearAnalysis()

    const councilName = council?.name ?? 'Royal Borough of Greenwich'
    await startCouncilAnalysis({
      region: regionKey(councilName),
      bounds: bounds ?? DEFAULT_BOUNDS,
      council: councilName,
      planCorpus: council?.planCorpus ?? null,
      force: true,
    })
  }

  const handleReset = () => {
    clearAnalysis()
    setExpanded(false)
  }

  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
      {/* Main action button */}
      {!isAnalysing && !hasResults && (
        <button
          onClick={handleAsk}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg transition-all duration-150 active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.5A3.75 3.75 0 0112 21a3.75 3.75 0 01-3.091-1.643l-.347-.5z" />
          </svg>
          Ask for Suggestions
        </button>
      )}

      {/* Reset button after analysis */}
      {!isAnalysing && hasResults && (
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg border border-gray-700 transition-all duration-150"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          New Analysis
        </button>
      )}

      {/* Stage progress card — shown while analysing */}
      {(isAnalysing || (expanded && !hasResults)) && (
        <div className="w-80 bg-gray-900/95 backdrop-blur border border-gray-700 rounded-xl shadow-2xl p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="block w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-sm font-semibold text-white">
                {isAnalysing ? 'Analysing…' : 'Analysis complete'}
              </span>
            </div>
            <span className="text-xs text-gray-500">{completedStages}/10 stages</span>
          </div>

          <StageProgress stages={stages} cachedAt={cachedAt} />
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="w-72 bg-red-950/90 border border-red-800 rounded-xl p-3 text-xs text-red-300">
          {error}
        </div>
      )}
    </div>
  )
}
