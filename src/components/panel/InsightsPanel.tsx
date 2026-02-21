'use client'

import { useSiteStore } from '@/stores/siteStore'
import { useInsights } from '@/hooks/useInsights'

/**
 * Generates AI-powered site insights via the server-side Gemini API proxy.
 *
 * Reads raw evidence from SiteContext, sends it to /api/insights (server-side),
 * and renders the returned analysis. No SiteContext data is exposed client-side
 * to the model — the serialisation and API call happen on the server.
 */
export function InsightsPanel() {
  const { siteContext } = useSiteStore()
  const { insight, isLoading, error, generateInsights, clearInsights } = useInsights()

  if (!siteContext) return null

  const hasEvidence =
    siteContext.planningPrecedentFeatures.features.length > 0 ||
    siteContext.planningContextStats !== null

  return (
    <section className="px-4 py-4 border-t border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <SparkleIcon />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            AI Insights
          </h3>
        </div>

        {insight && !isLoading && (
          <button
            onClick={clearInsights}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Trigger button */}
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

      {/* Insight text */}
      {insight && !isLoading && (
        <div className="space-y-3">
          <div className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
            {insight}
          </div>
          <button
            onClick={() => generateInsights(siteContext)}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Regenerate
          </button>
        </div>
      )}
    </section>
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
