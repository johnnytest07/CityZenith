'use client'

import { useSiteStore } from '@/stores/siteStore'
import { getDecisionHex } from '@/lib/colors'

/**
 * Reads planningPrecedentFeatures (raw GeoJSON) from SiteContext.
 * Computes counts and filters AT RENDER-TIME ONLY — nothing stored.
 */
export function PrecedentList() {
  const { siteContext, loadingStates } = useSiteStore()

  if (loadingStates.precedent) {
    return (
      <Section title="Planning Precedent">
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-800 rounded animate-pulse" />
          ))}
        </div>
      </Section>
    )
  }

  const features = siteContext?.planningPrecedentFeatures?.features ?? []

  if (features.length === 0) {
    return (
      <Section title="Planning Precedent">
        <p className="text-gray-600 text-xs">No planning applications found for this site.</p>
      </Section>
    )
  }

  // ---- Render-time computation only ----
  const twoYearsAgo = new Date()
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

  let approvedCount = 0
  let refusedCount = 0
  let recentCount = 0

  for (const f of features) {
    const d = (f.properties?.normalised_decision ?? '').toLowerCase()
    if (d.includes('approv')) approvedCount++
    else if (d.includes('refus') || d.includes('reject')) refusedCount++

    if (f.properties?.decision_date) {
      const dt = new Date(f.properties.decision_date)
      if (!isNaN(dt.getTime()) && dt >= twoYearsAgo) recentCount++
    }
  }
  // --------------------------------------

  // Sort by decision_date desc
  const sorted = [...features].sort((a, b) => {
    const da = a.properties?.decision_date ?? ''
    const db = b.properties?.decision_date ?? ''
    return db.localeCompare(da)
  })

  return (
    <Section title="Planning Precedent">
      {/* Render-time summary counts */}
      <div className="flex gap-3 mb-3 text-xs">
        <Stat label="Total" value={features.length} />
        <Stat label="Approved" value={approvedCount} color="#16a34a" />
        <Stat label="Refused" value={refusedCount} color="#dc2626" />
        <Stat label="Recent (2yr)" value={recentCount} />
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {sorted.map((feature, idx) => {
          const p = feature.properties ?? {}
          const decision = p.normalised_decision ?? p.decision ?? null
          const isBuffered = p.geometrySource === 'buffered-centroid'
          const decisionDate = p.decision_date
            ? new Date(p.decision_date).toLocaleDateString('en-GB', {
                year: 'numeric', month: 'short', day: 'numeric',
              })
            : null

          return (
            <div
              key={p.planning_reference ?? idx}
              className="bg-gray-900 border border-gray-800 rounded-lg p-3"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-mono text-gray-500 text-xs">{p.planning_reference}</span>
                {decision && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                    style={{
                      backgroundColor: `${getDecisionHex(decision)}22`,
                      color: getDecisionHex(decision),
                    }}
                  >
                    {decision}
                  </span>
                )}
              </div>

              {p.proposal && (
                <p className="text-gray-400 text-xs leading-relaxed line-clamp-2 mb-1">
                  {p.proposal}
                </p>
              )}

              <div className="flex items-center gap-2 text-gray-600 text-xs">
                {p.normalised_application_type && (
                  <span className="bg-gray-800 px-1.5 py-0.5 rounded">
                    {p.normalised_application_type}
                  </span>
                )}
                {decisionDate && <span>{decisionDate}</span>}
                {isBuffered && (
                  <span className="text-yellow-700 ml-auto">centroid approx.</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
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

function Stat({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color?: string
}) {
  return (
    <div className="flex flex-col items-center bg-gray-900 rounded px-2 py-1 min-w-0 flex-1">
      <span className="text-sm font-semibold tabular-nums" style={{ color: color ?? '#e5e7eb' }}>
        {value}
      </span>
      <span className="text-gray-600 text-xs truncate w-full text-center">{label}</span>
    </div>
  )
}
