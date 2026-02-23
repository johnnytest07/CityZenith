'use client'

import { useCallback, useEffect } from 'react'
import { MapCanvas } from '@/components/map/MapCanvas'
import { CouncilPanel } from './CouncilPanel'
import { CouncilAskButton } from './CouncilAskButton'
import { IdentityBadge } from '@/components/identity/IdentityGate'
import { useCouncilStore } from '@/stores/councilStore'
import { useMapStore } from '@/stores/mapStore'
import type { CouncilSuggestion } from '@/types/council'

/**
 * Council view layout:
 * ┌──────────────────────────────────┬──────────────┐
 * │  MapCanvas (full width)           │ CouncilPanel │
 * │  [CouncilAskButton — top-right]   │ (w-96,       │
 * │  [Council suggestion polygons]    │  conditional)│
 * └──────────────────────────────────┴──────────────┘
 */
export function CouncilView() {
  const { suggestions, selectedSuggestionId } = useCouncilStore()
  const { setViewState } = useMapStore()

  const panelVisible = suggestions.length > 0

  const handleFlyTo = useCallback(
    (suggestion: CouncilSuggestion) => {
      if (suggestion.geometry.type === 'Polygon') {
        const ring = suggestion.geometry.coordinates[0] as [number, number][]
        if (ring.length > 0) {
          const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length
          const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length
          setViewState({ longitude: lng, latitude: lat, zoom: 14 })
        }
      }
    },
    [setViewState],
  )

  // Fly to a suggestion whenever it becomes selected (map click or sidebar click)
  useEffect(() => {
    if (!selectedSuggestionId) return
    const s = suggestions.find((s) => s.id === selectedSuggestionId)
    if (s) handleFlyTo(s)
  }, [selectedSuggestionId, suggestions, handleFlyTo])

  return (
    <div className="flex h-screen w-screen bg-gray-950 overflow-hidden">
      {/* Map area */}
      <div className="relative flex-1 min-w-0">
        <MapCanvas />
        <CouncilAskButton />
        <IdentityBadge />
      </div>

      {/* Council panel — slides in after first suggestion */}
      {panelVisible && (
        <div className="w-96 shrink-0 overflow-hidden">
          <CouncilPanel />
        </div>
      )}
    </div>
  )
}
