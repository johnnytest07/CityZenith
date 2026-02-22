import { GeoJsonLayer, PolygonLayer, PathLayer } from '@deck.gl/layers'
import type { Layer } from '@deck.gl/core'
import type { CouncilSuggestion } from '@/types/council'
import { SUGGESTION_COLORS, SUGGESTION_STROKE_COLORS } from '@/lib/colors'

/**
 * Creates deck.gl layers for all council suggestions:
 * - Flat GeoJsonLayer for area suggestions (troubled_area, opportunity_zone, park, community, mixed_use, transport)
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

  // ── Flat area polygons ────────────────────────────────────────────────
  const areaTypes = new Set(['troubled_area', 'opportunity_zone', 'park', 'community', 'mixed_use', 'transport'])
  const areaFeatures: GeoJSON.Feature[] = suggestions
    .filter((s) => areaTypes.has(s.type) && (!selectedId || s.id === selectedId))
    .map((s) => ({
      type: 'Feature' as const,
      geometry: s.geometry,
      properties: { id: s.id, type: s.type, title: s.title, rationale: s.rationale },
    }))

  if (areaFeatures.length > 0) {
    layers.push(
      new GeoJsonLayer({
        id: 'council-suggestions-area',
        data: { type: 'FeatureCollection', features: areaFeatures },
        pickable: true,
        stroked: true,
        filled: true,
        extruded: false,
        getFillColor: (f: GeoJSON.Feature) => {
          const type = f.properties?.type as keyof typeof SUGGESTION_COLORS
          return SUGGESTION_COLORS[type] ?? [150, 150, 150, 80]
        },
        getLineColor: (f: GeoJSON.Feature) => {
          const type = f.properties?.type as keyof typeof SUGGESTION_STROKE_COLORS
          return SUGGESTION_STROKE_COLORS[type] ?? [150, 150, 150, 200]
        },
        lineWidthMinPixels: 1.5,
        parameters: { depthTest: false, depthMask: false },
        onClick: (info) => {
          const id = info.object?.properties?.id as string | undefined
          if (id && onSuggestionClick) {
            onSuggestionClick(id)
            return true
          }
        },
        onHover: (info) => {
          const id = info.object?.properties?.id as string | undefined
          onSuggestionHover?.(id ?? null)
        },
        updateTriggers: { getFillColor: [suggestions], getLineColor: [suggestions] },
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
        parameters: { depthTest: true },
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
