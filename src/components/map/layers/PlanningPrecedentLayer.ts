import { GeoJsonLayer } from '@deck.gl/layers'
import { getDecisionFillColor, getDecisionStrokeColor } from '@/lib/colors'
import type { RgbaColor } from '@/lib/colors'

/** Stable render priority: undetermined draws first (bottom), refused draws last (top). */
function decisionPriority(decision: string | null): number {
  if (!decision) return 0
  const d = decision.toLowerCase()
  if (d.includes('approv')) return 1
  if (d.includes('refus') || d.includes('reject')) return 2
  return 0
}

/**
 * Factory for the planning precedent deck.gl layer.
 *
 * Features are sorted by decision priority so refused always renders on top of
 * approved, giving a stable visual hierarchy regardless of frame order.
 * Fills use low alpha (light wash) with bold strokes so overlapping circles
 * don't compete visually.
 */
export function createPlanningPrecedentLayer(
  data: GeoJSON.FeatureCollection,
  onFeatureClick?: (feature: GeoJSON.Feature) => void,
) {
  // Sort: undetermined → approved → refused (last drawn = on top)
  const sorted: GeoJSON.FeatureCollection = {
    ...data,
    features: [...data.features].sort(
      (a, b) =>
        decisionPriority(a.properties?.normalised_decision) -
        decisionPriority(b.properties?.normalised_decision),
    ),
  }

  return new GeoJsonLayer({
    id: 'planning-precedent',
    data: sorted,
    pickable: true,
    stroked: true,
    filled: true,
    extruded: false,
    // depthTest: false prevents z-fighting with the basemap.
    // depthMask: false prevents these polygons writing to the depth buffer,
    // so they never occlude each other based on depth.
    parameters: { depthTest: false, depthMask: false },

    getFillColor: (f: GeoJSON.Feature): RgbaColor => {
      const decision = f.properties?.normalised_decision as string | null
      return getDecisionFillColor(decision)
    },

    getLineColor: (f: GeoJSON.Feature): RgbaColor => {
      const decision = f.properties?.normalised_decision as string | null
      const isBuffered = f.properties?.geometrySource === 'buffered-centroid'
      const base = getDecisionStrokeColor(decision)
      return isBuffered ? [base[0], base[1], base[2], 140] : base
    },

    getLineWidth: (f: GeoJSON.Feature): number => {
      return f.properties?.geometrySource === 'buffered-centroid' ? 1 : 2
    },

    lineWidthMinPixels: 1,
    lineWidthMaxPixels: 4,
    lineWidthUnits: 'pixels',

    onClick: (info) => {
      if (info.object && onFeatureClick) {
        onFeatureClick(info.object as GeoJSON.Feature)
      }
    },

    updateTriggers: {
      getFillColor: [data],
      getLineColor: [data],
      getLineWidth: [data],
    },
  })
}
