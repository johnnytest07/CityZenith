'use client'

import { useState } from 'react'
import { InsightCard } from './InsightCard'
import type { InsightsReport } from '@/types/insights'

interface InsightsDashboardProps {
  report:          InsightsReport
  onRegenerate?:   () => void
  onClear?:        () => void
  isRegenerating?: boolean
}

/**
 * Full structured insights dashboard.
 *
 * Shows:
 *   1. Overall summary paragraph
 *   2. High-priority cards, always visible
 *   3. "View all N insights" toggle for the remainder
 *   4. "Full analysis" accordion — fold-down of every card in detail
 *   5. Regenerate / Clear controls
 */
export function InsightsDashboard({
  report,
  onRegenerate,
  onClear,
  isRegenerating,
}: InsightsDashboardProps) {
  const [showAll, setShowAll]             = useState(false)
  const [showFullReport, setShowFullReport] = useState(false)

  const highItems = report.items.filter((i) => i.priority === 'high')
  const restItems = report.items.filter((i) => i.priority !== 'high')

  // Default visible: all high-priority + first 2 medium/low
  const defaultVisible = [...highItems, ...restItems.slice(0, 2)]
  const visibleItems   = showAll ? report.items : defaultVisible
  const hiddenCount    = report.items.length - defaultVisible.length

  return (
    <div className="space-y-3">
      {/* Overall summary */}
      <p className="text-xs text-gray-400 leading-relaxed">{report.summary}</p>

      {/* Insight cards */}
      <div className="space-y-1.5">
        {visibleItems.map((item) => (
          <InsightCard key={item.id} item={item} />
        ))}
      </div>

      {/* Show all / collapse toggle */}
      {hiddenCount > 0 && (
        <button
          onClick={() => setShowAll((s) => !s)}
          className="w-full py-1.5 text-xs text-gray-500 hover:text-gray-300
            border border-gray-800 hover:border-gray-700 rounded-lg transition-colors"
        >
          {showAll
            ? '↑ Show fewer insights'
            : `↓ Show all ${report.items.length} insights (+${hiddenCount} more)`}
        </button>
      )}

      {/* Full report drawer */}
      <div className="border border-gray-800 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowFullReport((s) => !s)}
          className="w-full flex items-center justify-between px-3 py-2.5
            hover:bg-white/[0.02] transition-colors text-left"
        >
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            Full Analysis
          </span>
          <svg
            className={`w-3 h-3 text-gray-600 transition-transform duration-150 ${showFullReport ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showFullReport && (
          <div className="px-3 pb-4 border-t border-gray-800 space-y-3 pt-3">
            <p className="text-xs text-gray-400 leading-relaxed">{report.summary}</p>
            {report.items.map((item) => (
              <div key={item.id} className="space-y-1">
                <p className="text-xs font-medium text-gray-200">{item.headline}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{item.detail}</p>
                {item.evidenceSources.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.evidenceSources.map((src, i) => (
                      <span
                        key={i}
                        className="text-[9px] text-gray-500 bg-gray-800/80 border border-gray-700/50 px-1.5 py-0.5 rounded"
                      >
                        {src}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Meta + controls */}
      <div className="flex items-center justify-between text-[9px] text-gray-600 pt-1">
        <span>
          {report.council} · {report.role === 'developer' ? 'Developer view' : 'Council view'}
        </span>
        <div className="flex items-center gap-3">
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="hover:text-gray-400 transition-colors disabled:opacity-40"
            >
              {isRegenerating ? 'Regenerating…' : 'Regenerate'}
            </button>
          )}
          {onClear && (
            <button onClick={onClear} className="hover:text-gray-400 transition-colors">
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
