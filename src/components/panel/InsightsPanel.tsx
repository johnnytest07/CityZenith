'use client'

import { useEffect, useState } from 'react'
import { useSiteStore } from '@/stores/siteStore'
import { useInsights } from '@/hooks/useInsights'
import { SectionCard } from './SectionCard'

/**
 * Generates AI-powered site insights via the server-side Gemini API proxy.
 * Auto-triggers once per site after planning data loads.
 */
export function InsightsPanel() {
  const { siteContext, loadingStates } = useSiteStore()
  const { insight, isLoading, error, generateInsights, clearInsights } = useInsights()
  const [expanded, setExpanded] = useState(false)

  // Auto-generate once per site after planning data finishes loading
  useEffect(() => {
    if (!siteContext) return
    if (insight || isLoading || error) return
    if (loadingStates.precedent || loadingStates.stats) return
    const hasEvidence =
      siteContext.planningPrecedentFeatures.features.length > 0 ||
      siteContext.planningContextStats !== null
    if (!hasEvidence) return
    generateInsights(siteContext)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteContext?.siteId, loadingStates.precedent, loadingStates.stats])

  if (!siteContext) return null

  const hasEvidence =
    siteContext.planningPrecedentFeatures.features.length > 0 ||
    siteContext.planningContextStats !== null

  const firstBullet = insight
    ? (insight.split('\n').find((l) => l.trim().startsWith('•'))?.replace(/^•\s*/, '') ??
       insight.split('\n')[0])
    : null

  const summary = isLoading ? (
    <span className="flex items-center gap-1.5 text-xs text-violet-400">
      <span className="w-2 h-2 border border-violet-500 border-t-violet-200 rounded-full animate-spin inline-block shrink-0" />
      Analysing site…
    </span>
  ) : error ? (
    <span className="text-xs text-red-400">Analysis failed — expand to retry</span>
  ) : firstBullet ? (
    <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{firstBullet}</p>
  ) : (
    <span className="text-xs text-gray-600">
      {hasEvidence ? 'Waiting for data…' : 'No evidence loaded'}
    </span>
  )

  return (
    <SectionCard
      title="AI Insights"
      summary={summary}
      expanded={expanded}
      onToggle={() => setExpanded((e) => !e)}
    >
      <div className="mt-2">
        {/* Trigger button — shown when no insight yet */}
        {!insight && !isLoading && !error && (
          <button
            onClick={() => generateInsights(siteContext)}
            disabled={!hasEvidence}
            title={!hasEvidence ? 'Waiting for planning data to load…' : undefined}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
              bg-violet-700 hover:bg-violet-600 active:bg-violet-800
              disabled:opacity-40 disabled:cursor-not-allowed
              text-white text-sm font-medium transition-colors"
          >
            <SparkleIcon />
            Generate insights with Gemini
          </button>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-zinc-400 py-3">
            <Spinner />
            <span>Analysing site evidence…</span>
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="bg-red-950/50 border border-red-800 rounded-lg px-3 py-2.5 space-y-2">
            <p className="text-red-400 text-xs">{error}</p>
            <button
              onClick={() => generateInsights(siteContext)}
              className="text-xs text-red-400 hover:text-red-200 underline transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Full insight text */}
        {insight && !isLoading && (
          <div className="space-y-3">
            <div className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
              {insight}
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => generateInsights(siteContext)}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Regenerate
              </button>
              <button
                onClick={clearInsights}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  )
}

function SparkleIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
      />
    </svg>
  )
}

function Spinner() {
  return (
    <div className="w-4 h-4 shrink-0 border-2 border-zinc-700 border-t-violet-400 rounded-full animate-spin" />
  )
}
