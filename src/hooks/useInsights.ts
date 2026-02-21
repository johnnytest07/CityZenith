'use client'

import { useCallback, useEffect } from 'react'
import { useSiteStore } from '@/stores/siteStore'
import { useIdentityStore } from '@/stores/identityStore'
import { useIntelligenceStore } from '@/stores/intelligenceStore'
import type { SiteContext, InsightBullet } from '@/types/siteContext'
import type { InsightsReport } from '@/types/insights'

export function useInsights() {
  const {
    insight,
    insightLoading,
    insightError,
    insightsReport,
    setInsight,
    setInsightLoading,
    setInsightError,
    setInsightBullets,
    setInsightsReport,
  } = useSiteStore()

  const { role, council } = useIdentityStore()
  const { setDocuments, setLoading, setError, clear } = useIntelligenceStore()

  useEffect(() => {
    // Only councils with a plan corpus should trigger document fetch
    if (council?.planCorpus) {
      const fetchDocs = async () => {
        setLoading(true)
        try {
          const response = await fetch('/api/intelligence/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planCorpus: council.planCorpus }),
          })
          if (!response.ok) {
            const data = await response.json()
            throw new Error(data.error || 'Failed to fetch documents.')
          }
          const documents = await response.json()
          setDocuments(documents)
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Unknown error')
        }
      }
      fetchDocs()
    } else {
      clear()
    }
  }, [council, setDocuments, setLoading, setError, clear])

  const generateInsights = useCallback(async (siteContext: SiteContext) => {
    setInsightLoading(true)
    setInsightError(null)

    try {
      const res = await fetch('/api/insights', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteContext,
          role:       role ?? 'developer',
          council:    council?.name ?? 'Unknown Council',
          planCorpus: council?.planCorpus ?? null,
        }),
      })

      const data = await res.json() as {
        report?:  unknown
        bullets?: unknown
        raw?:     string
        insight?: string
        error?:   string
      }

      if (!res.ok) {
        setInsightError(data.error ?? 'Failed to generate insights')
        setInsightLoading(false)
        return
      }

      // Structured report (new format)
      if (data.report != null) {
        setInsightsReport(data.report as InsightsReport)
      }

      // Backward-compat bullets
      if (Array.isArray(data.bullets)) {
        setInsightBullets(data.bullets as InsightBullet[])
      }

      // Raw text for legacy consumers
      if (typeof data.raw === 'string') {
        setInsight(data.raw)
      } else if (typeof data.insight === 'string') {
        setInsight(data.insight)
      }
    } catch (err) {
      setInsightError(err instanceof Error ? err.message : 'Request failed')
    }

    setInsightLoading(false)
  }, [role, council, setInsight, setInsightLoading, setInsightError, setInsightBullets, setInsightsReport])

  const clearInsights = useCallback(() => {
    useSiteStore.getState().clearInsight()
  }, [])

  return {
    insight,
    insightsReport,
    isLoading: insightLoading,
    error:     insightError,
    generateInsights,
    clearInsights,
  }
}
