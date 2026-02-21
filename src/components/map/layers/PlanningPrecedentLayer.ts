import { GeoJsonLayer } from '@deck.gl/layers'
import { getDecisionFillColor, getDecisionStrokeColor } from '@/lib/colors'
import type { RgbaColor } from '@/lib/colors'

/**
 * Factory for the planning precedent deck.gl layer.
 *
 * All features are polygons (normalised by lib/normalise.ts):
 *  - geometrySource: 'application-geometry' → solid outline
 *  - geometrySource: 'buffered-centroid' → dashed outline (via lower opacity stroke)
 *
 * Fill colour is derived from normalised_decision.
 */
export function createPlanningPrecedentLayer(
  data: GeoJSON.FeatureCollection,
  onFeatureClick?: (feature: GeoJSON.Feature) => void,
) {
  return new GeoJsonLayer({
    id: 'planning-precedent',
    data,
    pickable: true,
    stroked: true,
    filled: true,
    extruded: false,

    getFillColor: (f: GeoJSON.Feature): RgbaColor => {
      const decision = f.properties?.normalised_decision as string | null
      return getDecisionFillColor(decision)
    },

    getLineColor: (f: GeoJSON.Feature): RgbaColor => {
      const decision = f.properties?.normalised_decision as string | null
      const isBuffered = f.properties?.geometrySource === 'buffered-centroid'
      const base = getDecisionStrokeColor(decision)
      // Buffered centroids get lower opacity stroke to visually distinguish them
      return isBuffered ? [base[0], base[1], base[2], 100] : base
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
    },
  })
}
