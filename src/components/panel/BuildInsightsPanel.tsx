'use client'

import { useEffect, useMemo, useState } from 'react'
import { useIdentityStore } from '@/stores/identityStore'
import { useDevStore } from '@/stores/devStore'
import { InsightsDashboard } from '@/components/insights/InsightsDashboard'
import type { SiteContext } from '@/types/siteContext'
import type { InsightsReport } from '@/types/insights'

interface Props {
  siteContext: SiteContext
}

/**
 * AI insights panel for a newly placed building.
 * Uses the same /api/insights endpoint as InsightsPanel but scoped to the drawn polygon,
 * so Gemini evaluates the new building's specific footprint rather than the original click-site.
 * Self-contained local state — does not touch the global siteStore insight fields.
 */
export function BuildInsightsPanel({ siteContext }: Props) {
  const { role, council } = useIdentityStore()
  const { buildPolygon } = useDevStore()

  const [report, setReport]   = useState<InsightsReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // Swap the site geometry to the drawn building polygon so insights are
  // anchored to the new building's footprint rather than the original site click.
  const buildSiteContext = useMemo<SiteContext>(() => {
    if (!buildPolygon || buildPolygon.length < 3) return siteContext
    return {
      ...siteContext,
      // Prefix siteId so the global inflightRequests set in useInsights doesn't block us
      siteId: `build-${siteContext.siteId}`,
      siteGeometry: {
        type: 'Polygon',
        coordinates: [buildPolygon],
      },
    }
  }, [siteContext, buildPolygon])

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/insights', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteContext:  buildSiteContext,
          role:         role ?? 'developer',
          council:      council?.name ?? 'Unknown Council',
          planCorpus:   council?.planCorpus ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to generate insights')
        return
      }
      if (data.report) setReport(data.report as InsightsReport)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  // Auto-generate once on mount
  useEffect(() => { generate() }, [])

  return (
    <div className="px-3 py-3">
      {/* Context label */}
      <p className="text-[10px] text-violet-400/70 uppercase tracking-widest mb-3">
        New building · {buildPolygon ? `${Math.round(area(buildPolygon))}m² footprint` : 'proposed site'}
      </p>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-violet-400 py-4">
          <span className="w-3 h-3 border border-violet-500 border-t-violet-200 rounded-full animate-spin shrink-0" />
          Analysing proposed development…
        </div>
      )}

      {error && !loading && (
        <div className="space-y-2">
          <p className="text-xs text-red-400">{error}</p>
          <button
            onClick={generate}
            className="text-xs text-red-400 hover:text-red-200 underline transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && !report && (
        <button
          onClick={generate}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
            bg-violet-700 hover:bg-violet-600 text-white text-sm font-medium transition-colors"
        >
          <SparkleIcon />
          Generate building insights
        </button>
      )}

      {report && !loading && (
        <InsightsDashboard
          report={report}
          showScore={false}
          onRegenerate={generate}
          onClear={() => setReport(null)}
          isRegenerating={loading}
        />
      )}
    </div>
  )
}

/** Rough shoelace area in m² for a lon/lat ring (close enough for the footprint label). */
function area(ring: [number, number][]): number {
  const R = 6_371_000
  let a = 0
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[(i + 1) % ring.length]
    a += (x2 - x1) * (Math.PI / 180) * (y2 + y1) * (Math.PI / 180)
  }
  return Math.abs(a * R * R) / 2
}

function SparkleIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
      />
    </svg>
  )
}
