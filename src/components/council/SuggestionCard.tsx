'use client'

import { useState } from 'react'
import type { CouncilSuggestion } from '@/types/council'
import { SUGGESTION_HEX } from '@/lib/colors'
import { useCouncilStore } from '@/stores/councilStore'

const TYPE_LABELS: Record<string, string> = {
  troubled_area:    'Troubled Area',
  opportunity_zone: 'Opportunity Zone',
  park:             'Green Space',
  housing:          'Housing',
  bridge:           'Bridge',
  community:        'Community',
  mixed_use:        'Mixed Use',
  transport:        'Transport',
}

const PRIORITY_COLORS: Record<string, string> = {
  high:   'bg-red-500',
  medium: 'bg-amber-400',
  low:    'bg-gray-500',
}

interface SuggestionCardProps {
  suggestion: CouncilSuggestion
  onFlyTo: (suggestion: CouncilSuggestion) => void
}

export function SuggestionCard({ suggestion, onFlyTo }: SuggestionCardProps) {
  const { selectedSuggestionId, setSelectedSuggestion, setHoveredSuggestion } = useCouncilStore()
  const [expanded, setExpanded] = useState(false)

  const isSelected = selectedSuggestionId === suggestion.id
  const hexColor = SUGGESTION_HEX[suggestion.type] ?? '#6b7280'

  const handleClick = () => {
    setSelectedSuggestion(isSelected ? null : suggestion.id)
    onFlyTo(suggestion)
  }

  return (
    <div
      className={`rounded-xl border transition-all duration-150 cursor-pointer ${
        isSelected
          ? 'border-indigo-500 bg-gray-800/80 shadow-lg shadow-indigo-950/50'
          : 'border-gray-800 bg-gray-900/60 hover:border-gray-600 hover:bg-gray-800/50'
      }`}
      onClick={handleClick}
      onMouseEnter={() => setHoveredSuggestion(suggestion.id)}
      onMouseLeave={() => setHoveredSuggestion(null)}
    >
      <div className="p-3">
        {/* Header row */}
        <div className="flex items-start gap-2 mb-2">
          {/* Type badge */}
          <span
            className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
            style={{ backgroundColor: hexColor + '28', color: hexColor, border: `1px solid ${hexColor}55` }}
          >
            {TYPE_LABELS[suggestion.type] ?? suggestion.type}
          </span>

          {/* Priority dot */}
          <span
            className={`shrink-0 mt-1.5 w-2 h-2 rounded-full ${PRIORITY_COLORS[suggestion.priority] ?? 'bg-gray-500'}`}
            title={`${suggestion.priority} priority`}
          />

          {/* Title */}
          <span className="flex-1 text-sm font-semibold text-gray-200 leading-tight">
            {suggestion.title}
          </span>
        </div>

        {/* Rationale */}
        <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 mb-2">
          {suggestion.rationale}
        </p>

        {/* Implementation chips */}
        {suggestion.implementations.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {suggestion.implementations.map((impl, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 text-[10px] rounded bg-gray-800 text-gray-400 border border-gray-700"
              >
                + {impl.title || TYPE_LABELS[impl.type] || impl.type}
                {impl.heightM ? ` ${impl.heightM}m` : ''}
              </span>
            ))}
          </div>
        )}

        {/* Expand reasoning button */}
        <button
          className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(!expanded)
          }}
        >
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          {expanded ? 'Hide reasoning' : 'Expand reasoning'}
        </button>
      </div>

      {/* Expanded reasoning accordion */}
      {expanded && (
        <div
          className="px-3 pb-3 border-t border-gray-800 mt-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pt-3 space-y-2">
            {/* Reasoning paragraphs */}
            {suggestion.reasoning.split('\n\n').map((para, i) => (
              <p key={i} className="text-xs text-gray-300 leading-relaxed">
                {para}
              </p>
            ))}

            {/* Policy basis */}
            {suggestion.policyBasis && (
              <div className="mt-2 pt-2 border-t border-gray-800">
                <span
                  className="inline-block px-2 py-0.5 text-[10px] rounded-full font-medium"
                  style={{ backgroundColor: hexColor + '22', color: hexColor }}
                >
                  {suggestion.policyBasis}
                </span>
              </div>
            )}

            {/* Evidence sources */}
            {suggestion.evidenceSources.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-800">
                <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">Evidence</p>
                <ul className="space-y-0.5">
                  {suggestion.evidenceSources.map((src, i) => (
                    <li key={i} className="text-[11px] text-gray-500 italic">
                      · {src}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
