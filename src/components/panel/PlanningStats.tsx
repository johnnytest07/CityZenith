'use client'

import { useState } from 'react'
import type { PlanningContextStats } from '@/types/ibex'
import { useSiteStore } from '@/stores/siteStore'

export function PlanningStats() {
  const { siteContext, loadingStates } = useSiteStore()
  const stats: PlanningContextStats | null = siteContext?.planningContextStats ?? null

  const councilName = siteContext?.planningPrecedentFeatures?.features
    .find((f) => f.properties?.council_name)?.properties?.council_name ?? null

  if (loadingStates.stats) {
    return (
      <Section title="Council Context" scope={councilName ?? 'council-wide'}>
        <div className="space-y-3">
          <div className="h-6 w-24 bg-gray-800 rounded animate-pulse" />
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3 w-20 bg-gray-800 rounded animate-pulse" />
                <div className="h-3 w-10 bg-gray-800 rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="space-y-2 pt-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3 bg-gray-800 rounded animate-pulse" style={{ width: `${45 + i * 10}%` }} />
                <div className="h-3 w-8 bg-gray-800 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </Section>
    )
  }

  if (!stats) {
    return (
      <Section title="Council Context" scope={councilName ?? 'council-wide'}>
        <p className="text-gray-600 text-xs">No statistical data available for this site.</p>
      </Section>
    )
  }

  return (
    <Section title="Council Context" scope={councilName ?? 'council-wide'}>
      {/* Activity level */}
      {stats.council_development_activity_level && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-gray-500 text-xs">Activity</span>
          <span className="inline-block bg-indigo-950/60 border border-indigo-800/50 text-indigo-300 text-xs px-2 py-0.5 rounded-full font-medium capitalize">
            {stats.council_development_activity_level}
          </span>
        </div>
      )}

      {/* Approval / refusal rates */}
      {(stats.approval_rate != null || stats.refusal_rate != null) && (
        <div className="mb-4">
          <p className="text-gray-600 text-xs uppercase tracking-wide mb-2">Outcome rates</p>
          <div className="space-y-1.5">
            {stats.approval_rate != null && (
              <RateRow
                label="Approval"
                value={stats.approval_rate}
                color="bg-green-500"
                textColor="text-green-400"
              />
            )}
            {stats.refusal_rate != null && (
              <RateRow
                label="Refusal"
                value={stats.refusal_rate}
                color="bg-red-500"
                textColor="text-red-400"
              />
            )}
          </div>
        </div>
      )}

      {/* Applications by type */}
      {stats.number_of_applications && Object.keys(stats.number_of_applications).length > 0 && (
        <CollapsibleList
          title="Applications by type"
          entries={Object.entries(stats.number_of_applications)
            .filter(([, v]) => v > 0)
            .sort(([, a], [, b]) => b - a)}
          renderValue={(v) => v.toLocaleString()}
          maxVisible={5}
        />
      )}

      {/* Average decision time */}
      {stats.average_decision_time && Object.keys(stats.average_decision_time).length > 0 && (
        <CollapsibleList
          title="Avg. decision time"
          entries={Object.entries(stats.average_decision_time)
            .filter(([, v]) => v > 0)
            .sort(([, a], [, b]) => b - a)}
          renderValue={(v) => `${Math.round(v)}d`}
          maxVisible={4}
        />
      )}

      {/* New homes approved */}
      {stats.number_of_new_homes_approved != null && stats.number_of_new_homes_approved > 0 && (
        <div className="mt-1 pt-3 border-t border-gray-800">
          <p className="text-gray-600 text-xs uppercase tracking-wide mb-1">New homes approved</p>
          <span className="text-xl font-bold text-white tabular-nums">
            {stats.number_of_new_homes_approved.toLocaleString()}
          </span>
        </div>
      )}
    </Section>
  )
}

function RateRow({
  label,
  value,
  color,
  textColor,
}: {
  label: string
  value: number
  color: string
  textColor: string
}) {
  const pct = (value * 100).toFixed(1)
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className={`font-semibold tabular-nums ${textColor}`}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${Math.min(value * 100, 100)}%` }}
        />
      </div>
    </div>
  )
}

function CollapsibleList({
  title,
  entries,
  renderValue,
  maxVisible,
}: {
  title: string
  entries: [string, number][]
  renderValue: (v: number) => string
  maxVisible: number
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? entries : entries.slice(0, maxVisible)
  const hidden = entries.length - maxVisible

  return (
    <div className="mb-4">
      <p className="text-gray-600 text-xs uppercase tracking-wide mb-2">{title}</p>
      <div className="space-y-1">
        {visible.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-gray-400 truncate capitalize">{label.replace(/_/g, ' ')}</span>
            <span className="text-gray-200 tabular-nums font-medium flex-shrink-0">
              {renderValue(value)}
            </span>
          </div>
        ))}
      </div>
      {hidden > 0 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          {expanded ? '↑ Show less' : `↓ ${hidden} more`}
        </button>
      )}
    </div>
  )
}

function Section({ title, scope, children }: { title: string; scope?: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-gray-800">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
        {scope && (
          <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">{scope}</span>
        )}
      </div>
      {children}
    </div>
  )
}
