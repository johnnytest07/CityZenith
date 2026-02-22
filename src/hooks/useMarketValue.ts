'use client'

import { useEffect, useRef, useState } from 'react'

interface MarketValueResult {
  hexData: GeoJSON.FeatureCollection | null
  loading: boolean
  error: string | null
}

/**
 * Debounced hook that fetches market-value hex data when `enabled` is true
 * and `bounds` changes.  Cancels any in-flight request when a new one starts.
 *
 * 600ms debounce prevents thrashing while the user pans the map.
 */
export function useMarketValue(
  enabled: boolean,
  bounds: [number, number, number, number] | null,
): MarketValueResult {
  const [hexData, setHexData] = useState<GeoJSON.FeatureCollection | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stable key so the effect only fires when the rounded bounds actually change
  const boundsKey = bounds ? bounds.map((n) => n.toFixed(4)).join(',') : ''

  useEffect(() => {
    // Clear any pending debounce timer
    if (timerRef.current) clearTimeout(timerRef.current)

    if (!enabled || !bounds) {
      // Layer toggled off — clear data immediately
      if (!enabled) {
        setHexData(null)
        setError(null)
        setLoading(false)
        abortRef.current?.abort()
      }
      return
    }

    timerRef.current = setTimeout(async () => {
      // Cancel any in-flight request
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setLoading(true)
      setError(null)

      try {
        const res = await fetch('/api/market-value', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bounds }),
          signal: controller.signal,
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
        }

        const data = await res.json()
        setHexData(data.hexGrid as GeoJSON.FeatureCollection)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }, 600)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, boundsKey])

  return { hexData, loading, error }
}
