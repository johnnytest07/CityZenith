'use client'

import { useCallback, useRef } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { useSiteStore } from '@/stores/siteStore'
import { searchByPolygon, getStats } from '@/lib/ibexClient'
import { polygonToOsgbCoords } from '@/lib/coords'
import { normaliseApplicationsToFeatures } from '@/lib/normalise'
import { bufferClickPoint } from '@/lib/geometry'
import { fetchConstraintsForSite } from './useConstraintFetch'
import { getBuiltFormFeatures } from './useBuiltForm'

/**
 * Combines an AbortSignal with a timeout so requests are cancelled either
 * when the user clicks elsewhere OR after ms milliseconds — whichever comes first.
 */
function withTimeout(signal: AbortSignal, ms: number): AbortSignal {
  const tc = new AbortController()
  const timer = setTimeout(
    () => tc.abort(new DOMException('Request timed out', 'TimeoutError')),
    ms,
  )
  signal.addEventListener('abort', () => { clearTimeout(timer); tc.abort(signal.reason) }, { once: true })
  return tc.signal
}

/**
 * useSiteSelection — the core site selection orchestrator.
 *
 * Interaction model: every click places a 100m circle. Building detection is
 * intentionally disabled — all searches are circle-based. The circle geometry
 * is used for both the visual highlight and the IBEX/constraint queries.
 *
 * Every new click aborts all in-flight requests from the previous selection.
 * All requests have a hard 20s timeout so a slow API never freezes the browser.
 */
export function useSiteSelection(mapRef: React.RefObject<MapLibreMap | null>) {
  const { initialiseSiteContext, updateSiteContext, setLoading, setError, clearSiteContext } =
    useSiteStore()

  const selectionIdRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const selectSite = useCallback(
    async (lngLat: [number, number]) => {
      const map = mapRef.current
      if (!map) return

      // --- Abort all in-flight requests from the previous selection ---
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller

      console.group(`[selectSite] click @ [${lngLat[0].toFixed(6)}, ${lngLat[1].toFixed(6)}]`)

      // --- 1. Site geometry — always a 100m circle around the click point ---
      const siteGeometry = bufferClickPoint(lngLat, 0.1).geometry
      const searchPolygon27700 = polygonToOsgbCoords(siteGeometry)
      const constraintGeometry = bufferClickPoint(lngLat, 0.15).geometry

      console.log('siteGeometry: 100m circle')
      console.log('searchPolygon27700 vertex count:', searchPolygon27700.length)

      // --- 3. Initialise SiteContext — panel opens immediately with all skeletons ---
      const siteId = crypto.randomUUID()
      selectionIdRef.current = siteId
      initialiseSiteContext(siteId, siteGeometry)
      console.log('siteId:', siteId)

      const isStale = () => selectionIdRef.current !== siteId
      const isAborted = () => controller.signal.aborted

      // --- 4. Built form (synchronous MapLibre tile query — no network, no abort needed) ---
      try {
        const nearbyContextFeatures = getBuiltFormFeatures(map, siteGeometry)
        console.log('builtForm buildings:', nearbyContextFeatures.buildings.features.length,
          '| landuse:', nearbyContextFeatures.landuse.features.length)
        if (!isStale()) updateSiteContext({ nearbyContextFeatures })
      } catch (err) {
        console.warn('Built form extraction failed:', err)
      }

      console.groupEnd()

      // Signal with a hard 20s timeout — prevents any single request hanging the browser
      const searchSignal = withTimeout(controller.signal, 20_000)
      const constraintSignal = withTimeout(controller.signal, 15_000)

      // --- 5. IBEX /search → precedent features, then /stats using council_id ---
      searchByPolygon(searchPolygon27700, searchSignal)
        .then((apps) => {
          if (isStale()) return
          console.log(`[selectSite:${siteId.slice(0,8)}] IBEX search returned ${apps.length} applications`)
          updateSiteContext({ planningPrecedentFeatures: normaliseApplicationsToFeatures(apps) })

          const councilId = apps.find((a) => a.council_id != null)?.council_id
          console.log(`[selectSite:${siteId.slice(0,8)}] council_id:`, councilId ?? 'not found')
          if (councilId != null) {
            const statsSignal = withTimeout(controller.signal, 15_000)
            getStats(councilId, statsSignal)
              .then((stats) => {
                if (!isStale()) {
                  console.log(`[selectSite:${siteId.slice(0,8)}] IBEX stats received`, stats)
                  updateSiteContext({ planningContextStats: stats })
                }
              })
              .catch((err) => {
                if (isAborted() || (err instanceof Error && err.name === 'AbortError')) return
                console.warn('IBEX stats error (non-fatal):', err)
              })
              .finally(() => { if (!isStale()) setLoading('stats', false) })
          } else {
            if (!isStale()) setLoading('stats', false)
          }
        })
        .catch((err) => {
          if (isAborted() || (err instanceof Error && err.name === 'AbortError')) return
          if (!isStale()) {
            setLoading('stats', false)
            console.error('IBEX search error:', err)
            setError(`Planning search unavailable: ${err instanceof Error ? err.message : String(err)}`)
          }
        })
        .finally(() => { if (!isStale()) setLoading('precedent', false) })

      // --- 6. Statutory constraints ---
      fetchConstraintsForSite(constraintGeometry, constraintSignal)
        .then((constraints) => {
          if (!isStale()) {
            const summary = Object.entries(constraints).map(([k, v]) =>
              `${k}: ${v.intersects ? `✓ (${v.features?.features.length ?? 0})` : '✗'}`
            ).join(' | ')
            console.log(`[selectSite:${siteId.slice(0,8)}] constraints →`, summary)
            updateSiteContext({ statutoryConstraints: constraints })
          }
        })
        .catch((err) => {
          if (isAborted() || (err instanceof Error && err.name === 'AbortError')) return
          console.warn('Constraint fetch error (non-fatal):', err)
        })
        .finally(() => { if (!isStale()) setLoading('constraints', false) })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapRef],
  )

  const clearSelection = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    selectionIdRef.current = null
    clearSiteContext()
  }, [clearSiteContext])

  return { selectSite, clearSelection }
}
