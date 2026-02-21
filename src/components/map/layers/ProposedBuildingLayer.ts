import { PolygonLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'

/**
 * Creates an extruded PolygonLayer for the proposed building using the
 * user-drawn polygon as the footprint.
 */
export function createProposedBuildingLayer(
  polygon: [number, number][],
  heightM: number,
  onHover: (info: PickingInfo) => void,
): PolygonLayer {
  const data = [{ contour: polygon, height: heightM }]

  return new PolygonLayer({
    id: 'proposed-building',
    data,
    pickable: true,
    extruded: true,
    getPolygon: (d: { contour: [number, number][] }) => d.contour,
    getElevation: (d: { height: number }) => d.height,
    getFillColor: [139, 92, 246, 180],  // violet-500 semi-transparent
    getLineColor: [167, 139, 250, 255], // violet-400 solid
    lineWidthMinPixels: 2,
    parameters: { depthTest: true },
    onHover,
  })
}
