'use client'

import type { ReactNode } from 'react'

interface SectionCardProps {
  title: string
  scope?: string
  summary: ReactNode
  expanded: boolean
  onToggle: () => void
  children: ReactNode
}

/**
 * Collapsible section card used by all panel components.
 * Always shows title + summary; reveals children on expand.
 */
export function SectionCard({
  title,
  scope,
  summary,
  expanded,
  onToggle,
  children,
}: SectionCardProps) {
  return (
    <div className="border-b border-gray-800">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-start gap-2 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider shrink-0">
              {title}
            </span>
            {scope && (
              <span className="text-[10px] text-gray-600 bg-gray-800/80 px-1.5 py-0.5 rounded">
                {scope}
              </span>
            )}
          </div>
          <div className="mt-1">{summary}</div>
        </div>
        <svg
          className={`w-3 h-3 shrink-0 mt-1.5 text-gray-700 transition-transform duration-150 ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}
