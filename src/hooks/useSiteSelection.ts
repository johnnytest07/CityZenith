'use client'

import { useCallback, useRef } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { useSiteStore } from '@/stores/siteStore'
import { searchByPolygon, getStats } from '@/lib/ibexClient'
import { polygonToOsgbCoords } from '@/lib/coords'
import { normaliseApplicationsToFeatures } from '@/lib/normalise'
import { bufferClickPoint, getCentroid } from '@/lib/geometry'
import { fetchConstraintsForSite } from './useConstraintFetch'
import { getBuiltFormFeatures } from './useBuiltForm'

/**
 * useSiteSelection — the core site selection orchestrator.
 *
 * Returns `selectSite` which, on map click:
 * 1. Determines site geometry (picked polygon → building footprint → 100m buffer)
 * 2. Initialises SiteContext in the store (opens the panel immediately)
 * 3. Fires 4 data retrievals in parallel, updating the store as each resolves
 */
export function useSiteSelection(mapRef: React.RefObject<MapLibreMap | null>) {
  const store = useSiteStore()
  const { initialiseSiteContext, updateSiteContext, setLoading, setError, clearSiteContext } = store

  // Track current selection id to discard stale responses on rapid clicks
  const selectionIdRef = useRef<string | null>(null)

  const selectSite = useCallback(
    async (
      lngLat: [number, number],
      pickedFeature?: GeoJSON.Feature | null,
    ) => {
      const map = mapRef.current
      if (!map) return

      // --- 1. Determine site geometry ---
      let siteGeometry: GeoJSON.Geometry

      if (
        pickedFeature?.geometry &&
        (pickedFeature.geometry.type === 'Polygon' ||
          pickedFeature.geometry.type === 'MultiPolygon')
      ) {
        siteGeometry = pickedFeature.geometry
      } else {
        // Query MapLibre vector tiles for a building footprint at click point
        const centerPx = map.project(lngLat)
        const buildingFeatures = map.queryRenderedFeatures(
          [
            [centerPx.x - 4, centerPx.y - 4],
            [centerPx.x + 4, centerPx.y + 4],
          ],
          { layers: ['building-3d', 'building', '3d-buildings'] },
        )

        const buildingPolygon = buildingFeatures.find(
          (f) => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon',
        )

        siteGeometry = buildingPolygon
          ? (buildingPolygon.geometry as GeoJSON.Geometry)
          : bufferClickPoint(lngLat, 0.1).geometry
      }

      // --- 2. Initialise SiteContext in store ---
      const siteId = crypto.randomUUID()
      selectionIdRef.current = siteId
      initialiseSiteContext(siteId, siteGeometry)

      const isStale = () => selectionIdRef.current !== siteId

      // --- 3. Convert geometry to EPSG:27700 for IBEX ---
      let polygon27700: number[][]
      try {
        polygon27700 = polygonToOsgbCoords(siteGeometry)
      } catch {
        polygon27700 = polygonToOsgbCoords(bufferClickPoint(lngLat, 0.1).geometry)
      }

      // --- 4. D: Built form context (synchronous — MapLibre tile query) ---
      try {
        const nearbyContextFeatures = getBuiltFormFeatures(map, siteGeometry)
        if (!isStale()) updateSiteContext({ nearbyContextFeatures })
      } catch (err) {
        console.warn('Built form extraction failed:', err)
      }

      // --- 4. A: Planning precedent (IBEX /search) ---
      setLoading('precedent', true)
      searchByPolygon({ polygon: polygon27700, srid: 27700, extensions: ['appeals'] })
        .then((apps) => {
          if (isStale()) return
          updateSiteContext({ planningPrecedentFeatures: normaliseApplicationsToFeatures(apps) })
        })
        .catch((err) => {
          if (!isStale()) {
            console.error('IBEX search error:', err)
            setError(`Planning search unavailable: ${err instanceof Error ? err.message : String(err)}`)
          }
        })
        .finally(() => { if (!isStale()) setLoading('precedent', false) })

      // --- 4. B: Planning stats (IBEX /stats) ---
      setLoading('stats', true)
      getStats({ polygon: polygon27700, srid: 27700 })
        .then((stats) => {
          if (!isStale()) updateSiteContext({ planningContextStats: stats })
        })
        .catch((err) => {
          console.warn('IBEX stats error (non-fatal):', err)
        })
        .finally(() => { if (!isStale()) setLoading('stats', false) })

      // --- 4. C: Statutory constraints ---
      setLoading('constraints', true)
      fetchConstraintsForSite(siteGeometry)
        .then((constraints) => {
          if (!isStale()) updateSiteContext({ statutoryConstraints: constraints })
        })
        .catch((err) => {
          console.warn('Constraint fetch error (non-fatal):', err)
        })
        .finally(() => { if (!isStale()) setLoading('constraints', false) })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapRef],
  )

  const clearSelection = useCallback(() => {
    selectionIdRef.current = null
    clearSiteContext()
  }, [clearSiteContext])

  return { selectSite, clearSelection }
}
