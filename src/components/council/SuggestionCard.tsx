'use client'

import React, { useState } from 'react'
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

/** Renders **bold**, (LP PolicyRef) and (DP) tokens from LLM text */
function renderText(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*|\(LP[^)]*\)|\(DP\))/g)
  return parts.map((part, i) => {
    if (/^\*\*.*\*\*$/.test(part)) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (/^\(LP[^)]*\)$/.test(part)) {
      return (
        <span key={i} className="text-indigo-400 font-medium not-italic">
          {part}
        </span>
      )
    }
    if (part === '(DP)') {
      return (
        <span key={i} className="text-amber-400 font-medium not-italic">
          {part}
        </span>
      )
    }
    return part
  })
}

/** Inner accordion for analysis & evidence — collapsed by default */
function AnalysisAccordion({ suggestion, hexColor }: { suggestion: CouncilSuggestion; hexColor: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-3 pt-2 border-t border-gray-800">
      <button
        className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-400 transition-colors"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(!open)
        }}
      >
        <svg
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        Analysis &amp; Evidence
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {suggestion.reasoning.split('\n\n').map((para, i) => (
            <p key={i} className="text-xs text-gray-300 leading-relaxed">
              {renderText(para)}
            </p>
          ))}

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

          {suggestion.evidenceSources.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-800">
              <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">Evidence</p>
              <ul className="space-y-0.5">
                {suggestion.evidenceSources.map((src, i) => (
                  <li key={i} className="text-[11px] text-gray-500 italic">
                    · {renderText(src)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
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

          {/* Status badge */}
          <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
            suggestion.status === 'existing'
              ? 'bg-gray-800 text-gray-400 border border-gray-600'
              : 'bg-indigo-950/60 text-indigo-400 border border-indigo-700/40'
          }`}>
            {suggestion.status === 'existing' ? 'Existing' : 'Proposed'}
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
          {renderText(suggestion.rationale)}
        </p>

        {/* Problem box */}
        {suggestion.problem && (
          <div className="flex gap-1.5 bg-amber-950/30 border border-amber-800/30 rounded-lg px-2.5 py-1.5 mb-2">
            <span className="text-amber-400 shrink-0 text-[10px] mt-0.5">⚠</span>
            <p className="text-[11px] text-amber-200/80 leading-snug line-clamp-2">{renderText(suggestion.problem)}</p>
          </div>
        )}

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

        {/* Expand button */}
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
          {expanded ? 'Hide details' : 'Expand details'}
        </button>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div
          className="px-3 pb-3 border-t border-gray-800 mt-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Delivery plan — numbered stages */}
          {suggestion.implementations.length > 0 && (
            <div className="pt-3 space-y-2">
              <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-2">Delivery Plan</p>
              {[...suggestion.implementations]
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((impl, i) => (
                  <div key={i} className="flex gap-2.5">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-gray-800 border border-gray-700 text-[10px] text-gray-400 flex items-center justify-center font-medium">
                      {impl.order ?? i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-gray-200 leading-snug">{impl.title}</p>
                      <p className="text-[10px] text-gray-500 leading-snug mt-0.5">{renderText(impl.description)}</p>
                      {impl.projectedEffect && (
                        <p className="text-[10px] text-green-400/80 leading-snug mt-0.5">
                          → {renderText(impl.projectedEffect)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Overall projected outcome */}
          {suggestion.overallOutcome && (
            <div className="mt-3 pt-2 border-t border-gray-800">
              <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-1">Projected Outcome</p>
              <p className="text-[11px] text-green-300/80 leading-relaxed">{renderText(suggestion.overallOutcome)}</p>
            </div>
          )}

          {/* Parent relationship badge */}
          {suggestion.parentTitle && (
            <div className="mt-2">
              <span className="text-[10px] text-indigo-400/70 bg-indigo-950/40 border border-indigo-800/30 px-2 py-0.5 rounded-full">
                ↳ Sub-task of: {suggestion.parentTitle}
              </span>
            </div>
          )}

          {/* Analysis & Evidence accordion */}
          <AnalysisAccordion suggestion={suggestion} hexColor={hexColor} />
        </div>
      )}
    </div>
  )
}
