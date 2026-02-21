'use client'

import type { PlanningContextStats } from '@/types/ibex'
import { useSiteStore } from '@/stores/siteStore'

/**
 * Displays planning statistics from IBEX POST /stats as-is.
 * No interpretation, transformation, or inference.
 */
export function PlanningStats() {
  const { siteContext, loadingStates } = useSiteStore()
  const stats: PlanningContextStats | null = siteContext?.planningContextStats ?? null

  if (loadingStates.stats) {
    return (
      <Section title="Planning Statistics">
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-800 rounded animate-pulse" />
          ))}
        </div>
      </Section>
    )
  }

  if (!stats) {
    return (
      <Section title="Planning Statistics">
        <p className="text-gray-600 text-xs">No statistical data available for this site.</p>
      </Section>
    )
  }

  return (
    <Section title="Planning Statistics">
      {/* Number of applications by type */}
      {stats.numberOfApplications && (
        <div className="mb-4">
          <p className="text-gray-500 text-xs mb-2">Applications by type</p>
          <div className="space-y-1">
            {stats.numberOfApplications.total !== undefined && (
              <Row label="Total" value={String(stats.numberOfApplications.total)} highlight />
            )}
            {Object.entries(stats.numberOfApplications.byType ?? {}).map(([type, count]) => (
              <Row key={type} label={type} value={String(count)} />
            ))}
          </div>
        </div>
      )}

      {/* Average decision time */}
      {stats.averageDecisionTime && (
        <div className="mb-4">
          <p className="text-gray-500 text-xs mb-2">Average decision time</p>
          <div className="space-y-1">
            {stats.averageDecisionTime.weeks != null && (
              <Row label="Weeks" value={String(Math.round(stats.averageDecisionTime.weeks))} />
            )}
            {stats.averageDecisionTime.days != null && (
              <Row label="Days" value={String(Math.round(stats.averageDecisionTime.days))} />
            )}
            {Object.entries(stats.averageDecisionTime.byType ?? {}).map(([type, days]) => (
              <Row key={type} label={type} value={`${Math.round(days as number)}d`} />
            ))}
          </div>
        </div>
      )}

      {/* Outcome distributions */}
      {stats.outcomeDistributions && stats.outcomeDistributions.length > 0 && (
        <div className="mb-4">
          <p className="text-gray-500 text-xs mb-2">Outcome distribution</p>
          <div className="space-y-1">
            {stats.outcomeDistributions.map((d) => (
              <div key={d.decision} className="flex items-center justify-between gap-2">
                <DecisionBadge decision={d.decision} />
                <span className="text-gray-300 text-xs tabular-nums">{d.count}</span>
                {d.percentage != null && (
                  <span className="text-gray-500 text-xs tabular-nums">
                    {d.percentage.toFixed(1)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Development activity level */}
      {stats.developmentActivityLevel && (
        <div>
          <p className="text-gray-500 text-xs mb-1">Development activity</p>
          <span className="inline-block bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded">
            {stats.developmentActivityLevel}
          </span>
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

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-gray-500 truncate">{label}</span>
      <span className={highlight ? 'text-white font-semibold tabular-nums' : 'text-gray-300 tabular-nums'}>
        {value}
      </span>
    </div>
  )
}

function DecisionBadge({ decision }: { decision: string }) {
  const d = decision.toLowerCase()
  let color = 'bg-gray-700 text-gray-300'
  if (d.includes('approv')) color = 'bg-green-900/60 text-green-400'
  else if (d.includes('refus') || d.includes('reject')) color = 'bg-red-900/60 text-red-400'

  return (
    <span className={`${color} text-xs px-1.5 py-0.5 rounded font-medium truncate max-w-32`}>
      {decision}
    </span>
  )
}
