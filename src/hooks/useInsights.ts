'use client'

import { useCallback } from 'react'
import { useSiteStore } from '@/stores/siteStore'
import type { SiteContext } from '@/types/siteContext'

export function useInsights() {
  const {
    insight,
    insightLoading,
    insightError,
    setInsight,
    setInsightLoading,
    setInsightError,
    setInsightBullets,
  } = useSiteStore()

  const generateInsights = useCallback(async (siteContext: SiteContext) => {
    setInsightLoading(true)
    setInsightError(null)

    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteContext }),
      })

      const data = await res.json()

      if (!res.ok) {
        setInsightError(data.error ?? 'Failed to generate insights')
        setInsightLoading(false)
        return
      }

      // New structured response: { bullets, raw }
      // Legacy response: { insight } — handled as fallback
      if (data.raw != null) {
        setInsight(data.raw as string)
        if (Array.isArray(data.bullets)) {
          setInsightBullets(data.bullets)
        }
      } else if (data.insight != null) {
        setInsight(data.insight as string)
      }
    } catch (err) {
      setInsightError(err instanceof Error ? err.message : 'Request failed')
    }

    setInsightLoading(false)
  }, [setInsight, setInsightLoading, setInsightError, setInsightBullets])

  const clearInsights = useCallback(() => {
    useSiteStore.getState().clearInsight()
  }, [])

  return {
    insight,
    isLoading: insightLoading,
    error: insightError,
    generateInsights,
    clearInsights,
  }
}
