import { GeoJsonLayer, PolygonLayer, PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import type { Layer } from '@deck.gl/core'
import type { CouncilSuggestion } from '@/types/council'
import { SUGGESTION_COLORS, SUGGESTION_STROKE_COLORS } from '@/lib/colors'

/** Extract centroid [lng, lat] from a polygon geometry (mean of first ring) */
function centroidOf(geometry: GeoJSON.Geometry): [number, number] {
  if (geometry.type === 'Polygon') {
    const ring = geometry.coordinates[0]
    const lng = ring.reduce((sum, c) => sum + c[0], 0) / ring.length
    const lat = ring.reduce((sum, c) => sum + c[1], 0) / ring.length
    return [lng, lat]
  }
  if (geometry.type === 'Point') {
    return geometry.coordinates as [number, number]
  }
  return [0, 0]
}

/**
 * Creates deck.gl layers for all council suggestions:
 * - ScatterplotLayer (proposed) — solid filled circles
 * - ScatterplotLayer (existing) — ring-only circles (grey)
 * - Extruded PolygonLayer for housing implementations
 * - PathLayer for bridge implementations
 * - Selected highlight (white outline)
 * - Hovered highlight (yellow outline)
 */
export function createCouncilSuggestionLayers(
  suggestions: CouncilSuggestion[],
  selectedId: string | null,
  hoveredId: string | null,
  onSuggestionClick?: (id: string) => void,
  onSuggestionHover?: (id: string | null) => void,
): Layer[] {
  const layers: Layer[] = []

  if (suggestions.length === 0) return layers

  const visibleSuggestions = selectedId ? suggestions.filter((s) => s.id === selectedId) : suggestions
  const proposedSuggestions = visibleSuggestions.filter((s) => s.status !== 'existing')
  const existingSuggestions = visibleSuggestions.filter((s) => s.status === 'existing')

  // ── Proposed suggestions — solid filled circles ───────────────────────
  if (proposedSuggestions.length > 0) {
    layers.push(
      new ScatterplotLayer<CouncilSuggestion>({
        id: 'council-proposed-circles',
        data: proposedSuggestions,
        getPosition: (s) => centroidOf(s.geometry),
        getRadius: (s) => Math.min(s.implementations[0]?.radiusM ?? 200, 600),
        getFillColor: (s) => {
          const base = SUGGESTION_COLORS[s.type] ?? [150, 150, 150, 160]
          if (selectedId && s.id !== selectedId) return [base[0], base[1], base[2], 40]
          return base
        },
        getLineColor: (s) => SUGGESTION_STROKE_COLORS[s.type] ?? [150, 150, 150, 220],
        stroked: true,
        filled: true,
        lineWidthMinPixels: 2,
        radiusUnits: 'meters',
        pickable: true,
        onClick: (info) => {
          if (info.object && onSuggestionClick) {
            onSuggestionClick(info.object.id)
            return true
          }
        },
        onHover: (info) => {
          onSuggestionHover?.(info.object?.id ?? null)
        },
        updateTriggers: { getFillColor: [selectedId], getLineColor: [selectedId] },
      }),
    )
  }

  // ── Existing suggestions — ring-only circles (grey) ───────────────────
  if (existingSuggestions.length > 0) {
    layers.push(
      new ScatterplotLayer<CouncilSuggestion>({
        id: 'council-existing-circles',
        data: existingSuggestions,
        getPosition: (s) => centroidOf(s.geometry),
        getRadius: (s) => Math.min(s.implementations[0]?.radiusM ?? 200, 600),
        getFillColor: [80, 80, 90, 30],
        getLineColor: [160, 160, 170, 220],
        stroked: true,
        filled: true,
        lineWidthMinPixels: 2.5,
        radiusUnits: 'meters',
        pickable: true,
        onClick: (info) => {
          if (info.object && onSuggestionClick) {
            onSuggestionClick(info.object.id)
            return true
          }
        },
        onHover: (info) => {
          onSuggestionHover?.(info.object?.id ?? null)
        },
      }),
    )
  }

  // ── Housing implementations — extruded ───────────────────────────────
  const housingData: Array<{ contour: [number, number][]; heightM: number; suggestionId: string }> = []
  for (const s of suggestions) {
    for (const impl of s.implementations) {
      if (impl.type === 'housing' && impl.heightM !== null && impl.geometry && impl.geometry.type === 'Polygon') {
        housingData.push({
          contour: (impl.geometry as GeoJSON.Polygon).coordinates[0] as [number, number][],
          heightM: impl.heightM,
          suggestionId: s.id,
        })
      }
    }
  }

  const visibleHousing = selectedId
    ? housingData.filter((d) => d.suggestionId === selectedId)
    : housingData

  if (visibleHousing.length > 0) {
    layers.push(
      new PolygonLayer({
        id: 'council-suggestions-housing',
        data: visibleHousing,
        pickable: false,
        extruded: true,
        getPolygon: (d) => d.contour,
        getElevation: (d) => d.heightM,
        getFillColor: SUGGESTION_COLORS.housing,
        getLineColor: SUGGESTION_STROKE_COLORS.housing,
        lineWidthMinPixels: 1,
        parameters: { depthTest: false, depthMask: false },
      }),
    )
  }

  // ── Bridge implementations — elevated PathLayer ──────────────────────
  const bridgeData: Array<{ path: [number, number, number][]; suggestionId: string }> = []
  for (const s of suggestions) {
    for (const impl of s.implementations) {
      if (impl.type === 'bridge' && impl.geometry && impl.geometry.type === 'LineString') {
        const coords = (impl.geometry as GeoJSON.LineString).coordinates as [number, number, number][]
        bridgeData.push({ path: coords, suggestionId: s.id })
      }
    }
  }

  const visibleBridge = selectedId
    ? bridgeData.filter((d) => d.suggestionId === selectedId)
    : bridgeData

  if (visibleBridge.length > 0) {
    layers.push(
      new PathLayer({
        id: 'council-suggestions-bridge',
        data: visibleBridge,
        pickable: false,
        getPath: (d) => d.path,
        getColor: SUGGESTION_COLORS.bridge,
        getWidth: 6,
        widthUnits: 'pixels',
        positionFormat: 'XYZ',
        parameters: { depthTest: false },
      }),
    )
  }

  // ── Hovered highlight — yellow outline ───────────────────────────────
  if (hoveredId) {
    const hovered = suggestions.find((s) => s.id === hoveredId)
    if (hovered) {
      layers.push(
        new GeoJsonLayer({
          id: 'council-hovered',
          data: {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', geometry: hovered.geometry, properties: {} }],
          },
          stroked: true,
          filled: false,
          getLineColor: [253, 224, 71, 255], // yellow-300
          lineWidthMinPixels: 2.5,
          parameters: { depthTest: false, depthMask: false },
          pickable: false,
        }),
      )
    }
  }

  // ── Selected highlight — white outline ───────────────────────────────
  if (selectedId) {
    const selected = suggestions.find((s) => s.id === selectedId)
    if (selected) {
      layers.push(
        new GeoJsonLayer({
          id: 'council-selected',
          data: {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', geometry: selected.geometry, properties: {} }],
          },
          stroked: true,
          filled: false,
          getLineColor: [255, 255, 255, 255],
          lineWidthMinPixels: 3,
          parameters: { depthTest: false, depthMask: false },
          pickable: false,
        }),
      )
    }
  }

  return layers
}
