'use client'

import { useState } from 'react'
import { useSiteStore } from '@/stores/siteStore'
import { CONSTRAINT_TYPES, CONSTRAINT_LABELS, CONSTRAINT_SOURCES } from '@/types/constraints'
import { SectionCard } from './SectionCard'

const CONSTRAINT_COLORS: Record<string, { bg: string; text: string; dot: string; hex: string }> = {
  'green-belt':        { bg: 'bg-green-950/60',  text: 'text-green-400',  dot: 'bg-green-500',  hex: '#22c55e' },
  'conservation-area': { bg: 'bg-amber-950/60',  text: 'text-amber-400',  dot: 'bg-amber-500',  hex: '#f59e0b' },
  'article-4':         { bg: 'bg-purple-950/60', text: 'text-purple-400', dot: 'bg-purple-500', hex: '#a855f7' },
  'flood-risk':        { bg: 'bg-blue-950/60',   text: 'text-blue-400',   dot: 'bg-blue-500',   hex: '#3b82f6' },
}

/**
 * Displays statutory constraints that intersect the selected site.
 * Auto-populated on site click — no manual toggle.
 */
export function ConstraintsSummary() {
  const { siteContext, loadingStates, insightBullets } = useSiteStore()
  const [expanded, setExpanded] = useState(false)

  const insightBullet = insightBullets?.find((b) => b.category === 'constraints') ?? null

  if (loadingStates.constraints) {
    return (
      <SectionCard
        title="Statutory Constraints"
        summary={<span className="text-xs text-gray-700 animate-pulse">Checking…</span>}
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
      >
        <div className="space-y-2 mt-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 border border-gray-800 rounded-lg px-3 py-2 animate-pulse"
            >
              <div className="w-2 h-2 rounded-full bg-gray-700 flex-shrink-0" />
              <div className="h-3 bg-gray-700 rounded" style={{ width: `${40 + i * 12}%` }} />
            </div>
          ))}
        </div>
      </SectionCard>
    )
  }

  const constraints = siteContext?.statutoryConstraints
  const intersecting = constraints
    ? CONSTRAINT_TYPES.filter((t) => constraints[t].intersects)
    : []

  const summary =
    intersecting.length === 0 ? (
      <span className="text-xs text-gray-600">None identified</span>
    ) : (
      <div className="flex flex-wrap gap-1.5 mt-0.5">
        {intersecting.map((type) => {
          const c = CONSTRAINT_COLORS[type]
          return (
            <span
              key={type}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-gray-800"
              style={{ color: c?.hex }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
                style={{ backgroundColor: c?.hex }}
              />
              {CONSTRAINT_LABELS[type]}
            </span>
          )
        })}
      </div>
    )

  return (
    <SectionCard
      title="Statutory Constraints"
      summary={summary}
      expanded={expanded}
      onToggle={() => setExpanded((e) => !e)}
    >
      <div className="mt-2">
        {intersecting.length === 0 ? (
          <p className="text-gray-600 text-xs mb-3">
            No statutory constraints identified within site buffer.
          </p>
        ) : (
          <div className="space-y-2 mb-3">
            {intersecting.map((type) => {
              const colors = CONSTRAINT_COLORS[type]
              const layer = constraints![type]
              const featureCount = layer.features?.features.length ?? 0
              return (
                <div
                  key={type}
                  className={`${colors.bg} border border-gray-800 rounded-lg px-3 py-2 flex items-center gap-3`}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-medium ${colors.text}`}>
                      {CONSTRAINT_LABELS[type]}
                    </p>
                    <p className="text-gray-600 text-xs">
                      {featureCount} feature{featureCount !== 1 ? 's' : ''} ·{' '}
                      {CONSTRAINT_SOURCES[type]}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {constraints && (
          <div className="pt-3 border-t border-gray-800/50">
            <p className="text-gray-700 text-xs mb-2">Not present:</p>
            <div className="flex flex-wrap gap-1.5">
              {CONSTRAINT_TYPES.filter((t) => !constraints[t].intersects).map((type) => (
                <span
                  key={type}
                  className="bg-gray-900 text-gray-600 text-xs px-2 py-0.5 rounded"
                >
                  {CONSTRAINT_LABELS[type]}
                </span>
              ))}
            </div>
          </div>
        )}

        {insightBullet && (
          <div className="mt-3 pt-3 border-t border-violet-900/40 flex gap-2">
            <span className="text-violet-500 shrink-0 mt-0.5">✦</span>
            <p className="text-xs text-violet-300 leading-relaxed">{insightBullet.text}</p>
          </div>
        )}
      </div>
    </SectionCard>
  )
}
