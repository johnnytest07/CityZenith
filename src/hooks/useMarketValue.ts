'use client'

import { useEffect, useRef, useState } from 'react'
import { buildHexGrid, median } from '@/lib/pricePaid/aggregate'
import type { RawTransaction } from '@/lib/pricePaid/ingest'

interface MarketValueResult {
  hexData: GeoJSON.FeatureCollection | null
  loading: boolean
  error: string | null
}

/**
 * Accumulating market-value hook.
 *
 * - On first enable: fetches transactions for all visible outcodes.
 * - On pan to new area: fetches only NEW outcodes, merges into accumulated data.
 * - On zoom: instantly rebuilds hex grid from accumulated data (no server call).
 * - Data persists until the layer is toggled off.
 *
 * The server API now returns raw transactions + coordsMap for new outcodes only.
 * We build the hex grid client-side via turf.js so zoom is always instant.
 */
export function useMarketValue(
  enabled: boolean,
  bounds: [number, number, number, number] | null,
): MarketValueResult {
  const [hexData, setHexData] = useState<GeoJSON.FeatureCollection | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Persistent accumulation refs — survive re-renders and bounds changes
  const accTxRef = useRef<RawTransaction[]>([])
  const accCoordsRef = useRef<Map<string, [number, number]>>(new Map())
  const loadedOutcodesRef = useRef<Set<string>>(new Set())

  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stable key: 3dp precision → changes on meaningful pan/zoom (~111m per 0.001°)
  const boundsKey = bounds ? bounds.map((n) => n.toFixed(3)).join(',') : ''

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (!enabled) {
      // Toggle off — clear all accumulated data
      accTxRef.current = []
      accCoordsRef.current = new Map()
      loadedOutcodesRef.current = new Set()
      setHexData(null)
      setError(null)
      setLoading(false)
      abortRef.current?.abort()
      return
    }

    if (!bounds) return

    // Rebuild hex from accumulated data using the new bounds.
    // Deferred with a short timeout so the rebuild doesn't block zoom/pan
    // animation frames on the main thread.  The timer is cleared below if
    // bounds change again before it fires (effectively debouncing zoom).
    const localRebuildTimer = setTimeout(() => {
      if (accTxRef.current.length > 0) {
        const allPrices = accTxRef.current.map((t) => t.price)
        const boroughMedian = median(allPrices)
        setHexData(buildHexGrid(accTxRef.current, accCoordsRef.current, boroughMedian, bounds))
      }
    }, 150)

    // Debounce the server fetch for new outcodes
    timerRef.current = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setLoading(true)
      setError(null)

      try {
        const res = await fetch('/api/market-value', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bounds,
            knownOutcodes: [...loadedOutcodesRef.current],
          }),
          signal: controller.signal,
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
        }

        const data = (await res.json()) as {
          transactions: RawTransaction[]
          coordsMap: Record<string, [number, number]>
          newOutcodes: string[]
        }

        // Track all loaded outcodes (even if transactions came back empty)
        for (const oc of data.newOutcodes) {
          loadedOutcodesRef.current.add(oc)
        }

        // Merge new transactions and coords into accumulated store
        if (data.transactions.length > 0) {
          accTxRef.current = [...accTxRef.current, ...data.transactions]
          for (const [k, v] of Object.entries(data.coordsMap)) {
            accCoordsRef.current.set(k, v)
          }

          // Rebuild hex grid with all accumulated data
          const allPrices = accTxRef.current.map((t) => t.price)
          const boroughMedian = median(allPrices)
          setHexData(buildHexGrid(accTxRef.current, accCoordsRef.current, boroughMedian, bounds))
        }
        // If no new transactions, hex grid already up-to-date from the instant rebuild above
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }, 600)

    return () => {
      clearTimeout(localRebuildTimer)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, boundsKey])

  return { hexData, loading, error }
}
