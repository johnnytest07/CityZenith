'use client'

import { useEffect } from 'react'
import { useControl } from 'react-map-gl/maplibre'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { Layer, PickingInfo } from '@deck.gl/core'

interface DeckOverlayProps {
  layers: Layer[]
  getTooltip?: (info: PickingInfo) => { html: string; style?: Record<string, string> } | null
}

/**
 * Mounts a deck.gl MapboxOverlay inside the react-map-gl MapLibre context.
 * interleaved: true ensures deck.gl renders within the MapLibre WebGL context,
 * enabling correct depth ordering with map labels and 3D buildings.
 */
export function DeckOverlay({ layers, getTooltip }: DeckOverlayProps) {
  const overlay = useControl<MapboxOverlay>(
    () => new MapboxOverlay({ interleaved: true, layers, getTooltip }),
  )

  useEffect(() => {
    overlay.setProps({ layers, getTooltip })
  }, [overlay, layers, getTooltip])

  return null
}
