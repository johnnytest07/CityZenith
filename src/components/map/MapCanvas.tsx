'use client'

import { useRef, useCallback, useMemo } from 'react'
import Map, { type MapRef, type ViewStateChangeEvent, type MapLayerMouseEvent } from 'react-map-gl/maplibre'
import type { Map as MapLibreMap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { DeckOverlay } from './DeckOverlay'
import { useSiteStore } from '@/stores/siteStore'
import { useMapStore } from '@/stores/mapStore'
import { useSiteSelection } from '@/hooks/useSiteSelection'
import { createPlanningPrecedentLayer } from './layers/PlanningPrecedentLayer'
import { createConstraintOverlayLayer } from './layers/ConstraintOverlayLayer'
import { createSiteHighlightLayer } from './layers/SiteHighlightLayer'
import { CONSTRAINT_TYPES } from '@/types/constraints'
import type { Layer } from '@deck.gl/core'

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? ''

// MapTiler streets-v2 includes OpenMapTiles building layer with render_height data
// Falls back to CartoCDN dark-matter if no key provided
const MAP_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`
  : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

export function MapCanvas() {
  const mapRef = useRef<MapRef>(null)
  const { viewState, setViewState, setBounds } = useMapStore()
  const { siteContext } = useSiteStore()

  // Cast MapRef to MapLibreMap for useSiteSelection
  const mapLibreRef = useRef<MapLibreMap | null>(null)

  const { selectSite, clearSelection } = useSiteSelection(mapLibreRef)

  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    mapLibreRef.current = map as unknown as MapLibreMap

    // Add 3D building extrusion using MapLibre native fill-extrusion.
    // Insert below the first symbol (label) layer so text stays readable above buildings.
    if (!map.getLayer('3d-buildings')) {
      const buildingSource = map.getSource('openmaptiles') ? 'openmaptiles' : 'composite'

      // Dynamically find the first symbol layer to insert below — avoids hardcoding a
      // layer name that may not exist and silently break the addLayer call.
      const firstSymbolLayerId = map
        .getStyle()
        .layers.find((l) => l.type === 'symbol')?.id

      try {
        map.addLayer(
          {
            id: '3d-buildings',
            source: buildingSource,
            'source-layer': 'building',
            type: 'fill-extrusion',
            minzoom: 13,
            paint: {
              'fill-extrusion-color': [
                'interpolate', ['linear'], ['zoom'],
                13, '#1c1c1e',
                16, '#2d2d30',
              ],
              // coalesce: render_height → height → 0, so buildings without height
              // data still extrude at a nominal 4m rather than staying flat
              'fill-extrusion-height': [
                'interpolate', ['linear'], ['zoom'],
                13, 0,
                14, ['coalesce', ['get', 'render_height'], ['get', 'height'], 4],
              ],
              'fill-extrusion-base': [
                'coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0,
              ],
              'fill-extrusion-opacity': 0.85,
            },
          },
          firstSymbolLayerId, // insert below labels; undefined = append on top (safe fallback)
        )
      } catch (err) {
        console.warn('Could not add 3D buildings layer:', err)
      }
    }
  }, [])

  const handleMove = useCallback(
    (evt: ViewStateChangeEvent) => {
      setViewState(evt.viewState)
      const map = mapRef.current?.getMap()
      if (map) {
        const b = map.getBounds()
        setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()])
      }
    },
    [setViewState, setBounds],
  )

  const handleClick = useCallback(
    (evt: MapLayerMouseEvent) => {
      const { lngLat } = evt
      const lngLatArr: [number, number] = [lngLat.lng, lngLat.lat]

      // Check if a planning precedent feature was clicked via deck.gl
      // deck.gl handles its own click via layer's onClick prop — here we
      // handle plain map clicks (building footprints, empty land)
      selectSite(lngLatArr, null)
    },
    [selectSite],
  )

  // Build deck.gl layers from SiteContext
  const deckLayers = useMemo((): Layer[] => {
    if (!siteContext) return []

    const layers: Layer[] = []

    // Site highlight
    layers.push(createSiteHighlightLayer(siteContext.siteGeometry))

    // Planning precedent polygons
    if (siteContext.planningPrecedentFeatures.features.length > 0) {
      layers.push(
        createPlanningPrecedentLayer(
          siteContext.planningPrecedentFeatures,
          (feature) => {
            // Re-select with the clicked planning feature's geometry
            const center = feature.geometry.type === 'Polygon'
              ? (feature.geometry.coordinates[0][0] as [number, number])
              : [feature.properties?.longitude ?? 0, feature.properties?.latitude ?? 0] as [number, number]
            selectSite(center, feature)
          },
        ),
      )
    }

    // Constraint overlays (only intersecting constraints)
    for (const type of CONSTRAINT_TYPES) {
      const layer = siteContext.statutoryConstraints[type]
      if (layer.intersects && layer.features && layer.features.features.length > 0) {
        layers.push(createConstraintOverlayLayer(type, layer.features))
      }
    }

    return layers
  }, [siteContext, selectSite])

  return (
    <Map
      ref={mapRef}
      {...viewState}
      onMove={handleMove}
      onClick={handleClick}
      onLoad={handleMapLoad}
      mapStyle={MAP_STYLE}
      attributionControl={false}
      style={{ width: '100%', height: '100%' }}
    >
      <DeckOverlay layers={deckLayers} />
    </Map>
  )
}
