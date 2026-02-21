'use client'

import { useState, useCallback } from 'react'
import type { SiteContext } from '@/types/siteContext'

interface InsightsState {
  insight: string | null
  isLoading: boolean
  error: string | null
}

const INITIAL: InsightsState = { insight: null, isLoading: false, error: null }

export function useInsights() {
  const [state, setState] = useState<InsightsState>(INITIAL)

  const generateInsights = useCallback(async (siteContext: SiteContext) => {
    setState({ insight: null, isLoading: true, error: null })

    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteContext }),
      })

      const data = await res.json()

      if (!res.ok) {
        setState({
          insight: null,
          isLoading: false,
          error: data.error ?? 'Failed to generate insights',
        })
        return
      }

      setState({ insight: data.insight as string, isLoading: false, error: null })
    } catch (err) {
      setState({
        insight: null,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Request failed',
      })
    }
  }, [])

  const clearInsights = useCallback(() => setState(INITIAL), [])

  return { ...state, generateInsights, clearInsights }
}
