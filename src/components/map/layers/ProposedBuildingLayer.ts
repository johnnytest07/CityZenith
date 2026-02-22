import { PolygonLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'

/**
 * Creates an extruded PolygonLayer for the proposed building using the
 * user-drawn polygon as the footprint.
 */
export function createProposedBuildingLayer(
  polygon: [number, number][],
  heightM: number,
  color: [number, number, number, number],
  onHover: (info: PickingInfo) => void,
): PolygonLayer {
  const data = [{ contour: polygon, height: heightM }]
  const lineColor: [number, number, number, number] = [color[0], color[1], color[2], 255]

  return new PolygonLayer({
    id: 'proposed-building',
    data,
    pickable: true,
    extruded: true,
    getPolygon: (d: { contour: [number, number][] }) => d.contour,
    getElevation: (d: { height: number }) => d.height,
    getFillColor: color,
    getLineColor: lineColor,
    lineWidthMinPixels: 2,
    parameters: { depthTest: true },
    onHover,
  })
}
