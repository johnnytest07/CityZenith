'use client'

import { useEffect } from 'react'
import { useControl } from 'react-map-gl/maplibre'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { Layer } from '@deck.gl/core'

interface DeckOverlayProps {
  layers: Layer[]
}

/**
 * Mounts a deck.gl MapboxOverlay inside the react-map-gl MapLibre context.
 * interleaved: true ensures deck.gl renders within the MapLibre WebGL context,
 * enabling correct depth ordering with map labels and 3D buildings.
 */
export function DeckOverlay({ layers }: DeckOverlayProps) {
  const overlay = useControl<MapboxOverlay>(
    () => new MapboxOverlay({ interleaved: true, layers }),
  )

  useEffect(() => {
    overlay.setProps({ layers })
  }, [overlay, layers])

  return null
}
