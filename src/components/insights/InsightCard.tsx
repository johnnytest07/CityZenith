'use client'

import { useState } from 'react'
import type { InsightItem } from '@/types/insights'

const CATEGORY_CONFIG = {
  planning: {
    label: 'Planning',
    icon:  '📋',
    ring:  'border-blue-800/60',
    badge: 'text-blue-400 bg-blue-950/60',
  },
  constraints: {
    label: 'Constraints',
    icon:  '⚠️',
    ring:  'border-amber-800/60',
    badge: 'text-amber-400 bg-amber-950/60',
  },
  built_form: {
    label: 'Built Form',
    icon:  '🏙️',
    ring:  'border-emerald-800/60',
    badge: 'text-emerald-400 bg-emerald-950/60',
  },
  council: {
    label: 'Council',
    icon:  '🏛️',
    ring:  'border-violet-800/60',
    badge: 'text-violet-400 bg-violet-950/60',
  },
  connectivity: {
    label: 'Connectivity',
    icon:  '🚆',
    ring:  'border-sky-800/60',
    badge: 'text-sky-400 bg-sky-950/60',
  },
} as const

const PRIORITY_DOT: Record<string, string> = {
  high:   'bg-red-500',
  medium: 'bg-amber-500',
  low:    'bg-gray-600',
}

const PRIORITY_LABEL: Record<string, string> = {
  high:   'High',
  medium: 'Medium',
  low:    'Low',
}

/** Renders **bold** markdown inline as <strong> elements. */
function BoldText({ text }: { text: string }) {
  const parts = text.split(/\*\*/)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i} className="text-white font-semibold">{part}</strong> : part,
      )}
    </>
  )
}

/**
 * Expandable insight card.
 * Face shows icon + category badge + priority dot + headline.
 * Expanded section shows the detailed analysis and evidence sources.
 */
export function InsightCard({ item }: { item: InsightItem }) {
  const [expanded, setExpanded] = useState(false)
  const cat = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.planning

  return (
    <div className={`rounded-lg border bg-gray-900/60 ${cat.ring} overflow-hidden`}>
      {/* Card face */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-start gap-2.5">
          <span className="text-sm leading-none mt-0.5 shrink-0">{cat.icon}</span>

          <div className="flex-1 min-w-0">
            {/* Meta row */}
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${cat.badge}`}>
                {cat.label}
              </span>
              <span className="flex items-center gap-1 text-[9px] text-gray-500">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[item.priority] ?? 'bg-gray-600'}`} />
                {PRIORITY_LABEL[item.priority] ?? item.priority}
              </span>
            </div>
            {/* Headline */}
            <p className="text-xs text-gray-300 leading-snug"><BoldText text={item.headline} /></p>
          </div>

          {/* Chevron */}
          <svg
            className={`w-3 h-3 shrink-0 mt-1 text-gray-600 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Drill-down detail */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-white/5 space-y-2">
          <p className="text-xs text-gray-300 leading-relaxed">{item.detail}</p>
          {item.evidenceSources.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
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
      )}
    </div>
  )
}
