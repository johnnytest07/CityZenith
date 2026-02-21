'use client'

import { useSiteStore } from '@/stores/siteStore'
import { CONSTRAINT_TYPES, CONSTRAINT_LABELS, CONSTRAINT_SOURCES } from '@/types/constraints'

const CONSTRAINT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'green-belt': { bg: 'bg-green-950/60', text: 'text-green-400', dot: 'bg-green-500' },
  'conservation-area': { bg: 'bg-amber-950/60', text: 'text-amber-400', dot: 'bg-amber-500' },
  'article-4': { bg: 'bg-purple-950/60', text: 'text-purple-400', dot: 'bg-purple-500' },
  'flood-risk': { bg: 'bg-blue-950/60', text: 'text-blue-400', dot: 'bg-blue-500' },
}

/**
 * Displays statutory constraints that intersect the selected site.
 * Auto-populated on site click — no manual toggle.
 * Displayed for spatial awareness only.
 */
export function ConstraintsSummary() {
  const { siteContext, loadingStates } = useSiteStore()

  if (loadingStates.constraints) {
    return (
      <Section title="Statutory Constraints">
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 bg-gray-800 rounded animate-pulse" />
          ))}
        </div>
      </Section>
    )
  }

  const constraints = siteContext?.statutoryConstraints

  const intersecting = constraints
    ? CONSTRAINT_TYPES.filter((t) => constraints[t].intersects)
    : []

  return (
    <Section title="Statutory Constraints">
      {intersecting.length === 0 ? (
        <p className="text-gray-600 text-xs">No statutory constraints identified within site buffer.</p>
      ) : (
        <div className="space-y-2">
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
                    {featureCount} feature{featureCount !== 1 ? 's' : ''} · {CONSTRAINT_SOURCES[type]}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Show non-intersecting in a muted list */}
      {constraints && (
        <div className="mt-3 pt-3 border-t border-gray-800/50">
          <p className="text-gray-700 text-xs mb-2">Not present:</p>
          <div className="flex flex-wrap gap-1.5">
            {CONSTRAINT_TYPES.filter((t) => !constraints[t].intersects).map((type) => (
              <span key={type} className="bg-gray-900 text-gray-600 text-xs px-2 py-0.5 rounded">
                {CONSTRAINT_LABELS[type]}
              </span>
            ))}
          </div>
        </div>
      )}
    </Section>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-gray-800">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  )
}
