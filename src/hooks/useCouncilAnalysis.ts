'use client'

import { useCallback, useRef } from 'react'
import { useCouncilStore } from '@/stores/councilStore'
import type { CouncilSuggestion, AnalysisStage } from '@/types/council'

interface AnalysisRequest {
  region: string
  bounds: [number, number, number, number] // [w, s, e, n]
  council: string
  planCorpus: string | null
  force?: boolean
}

/**
 * SSE consumer for the council analysis stream.
 * Reads EventSource events and dispatches to councilStore.
 */
export function useCouncilAnalysis() {
  const {
    startAnalysis,
    setCacheHit,
    receiveStageStart,
    receiveSuggestion,
    receiveStageComplete,
    finishAnalysis,
    setError,
  } = useCouncilStore()

  const eventSourceRef = useRef<EventSource | null>(null)

  const startCouncilAnalysis = useCallback(
    async (request: AnalysisRequest) => {
      // Abort any in-flight analysis
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }

      startAnalysis()

      try {
        // POST to the SSE endpoint — convert to GET-style SSE by POSTing params
        // then opening EventSource with query params
        const params = new URLSearchParams({
          region: request.region,
          council: request.council,
          bounds: request.bounds.join(','),
          planCorpus: request.planCorpus ?? '',
        })

        // Use fetch + ReadableStream for POST-based SSE (EventSource only supports GET)
        const res = await fetch('/api/council/analyse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setError((data as { error?: string }).error ?? `Analysis failed: ${res.status}`)
          return
        }

        if (!res.body) {
          setError('No response body from analysis endpoint')
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        const processBuffer = () => {
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? '' // Keep incomplete line in buffer

          let currentEvent = ''
          let currentData = ''

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim()
            } else if (line.startsWith('data: ')) {
              currentData = line.slice(6).trim()
            } else if (line === '' && currentEvent && currentData) {
              // Dispatch event
              try {
                const payload = JSON.parse(currentData)
                switch (currentEvent) {
                  case 'cache_hit': {
                    const { cachedAt } = payload as { cachedAt: string }
                    setCacheHit(cachedAt)
                    break
                  }
                  case 'stage_start': {
                    const { stageNum, fromCache } = payload as AnalysisStage
                    receiveStageStart(stageNum, fromCache)
                    break
                  }
                  case 'suggestion': {
                    receiveSuggestion(payload as CouncilSuggestion)
                    break
                  }
                  case 'stage_complete': {
                    const { stageNum, suggestionCount } = payload as {
                      stageNum: number
                      suggestionCount: number
                    }
                    receiveStageComplete(stageNum, suggestionCount)
                    break
                  }
                  case 'complete': {
                    finishAnalysis()
                    break
                  }
                  case 'error': {
                    setError((payload as { message?: string }).message ?? 'Analysis error')
                    break
                  }
                }
              } catch {
                // Skip malformed JSON
              }
              currentEvent = ''
              currentData = ''
            }
          }
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            finishAnalysis()
            break
          }
          buffer += decoder.decode(value, { stream: true })
          processBuffer()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Analysis failed')
      }
    },
    [startAnalysis, setCacheHit, receiveStageStart, receiveSuggestion, receiveStageComplete, finishAnalysis, setError],
  )

  const cancelAnalysis = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    finishAnalysis()
  }, [finishAnalysis])

  return { startCouncilAnalysis, cancelAnalysis }
}
