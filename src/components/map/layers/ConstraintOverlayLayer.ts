import { GeoJsonLayer } from '@deck.gl/layers'
import { CONSTRAINT_FILL_COLORS, CONSTRAINT_STROKE_COLORS } from '@/lib/colors'
import type { ConstraintType } from '@/types/constraints'

/**
 * Factory for constraint overlay deck.gl layers.
 * One layer per constraint type, rendered automatically on site selection.
 */
export function createConstraintOverlayLayer(
  constraintType: ConstraintType,
  data: GeoJSON.FeatureCollection,
) {
  const fillColor = CONSTRAINT_FILL_COLORS[constraintType] ?? [128, 128, 128, 38]
  const strokeColor = CONSTRAINT_STROKE_COLORS[constraintType] ?? [100, 100, 100, 200]

  return new GeoJsonLayer({
    id: `constraint-${constraintType}`,
    data,
    pickable: false,
    stroked: true,
    filled: true,
    extruded: false,
    parameters: { depthTest: false, depthMask: false },

    getFillColor: fillColor,
    getLineColor: strokeColor,
    getLineWidth: 2,
    lineWidthMinPixels: 1,
    lineWidthMaxPixels: 3,
    lineWidthUnits: 'pixels',
  })
}
