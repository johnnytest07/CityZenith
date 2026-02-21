import { PolygonLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import type { BuildingOption } from '@/types/devMode'

/**
 * Compute the four corners of a square footprint centred at the given
 * WGS84 location, with side length √approxFootprintM2 metres.
 */
function squareFootprint(
  location: [number, number],
  footprintM2: number,
): [number, number][] {
  const [lng, lat] = location
  const side = Math.sqrt(footprintM2)
  const halfSide = side / 2
  const dLng = halfSide / (111320 * Math.cos((lat * Math.PI) / 180))
  const dLat = halfSide / 111320
  return [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat - dLat],
    [lng + dLng, lat + dLat],
    [lng - dLng, lat + dLat],
    [lng - dLng, lat - dLat], // close the ring
  ]
}

export function createProposedBuildingLayer(
  location: [number, number],
  option: BuildingOption,
  onHover: (info: PickingInfo) => void,
): PolygonLayer {
  const coords = squareFootprint(location, option.approxFootprintM2)
  const data = [{ contour: coords, height: option.approxHeightM }]

  return new PolygonLayer({
    id: 'proposed-building',
    data,
    pickable: true,
    extruded: true,
    getPolygon: (d: { contour: [number, number][] }) => d.contour,
    getElevation: (d: { height: number }) => d.height,
    getFillColor: [139, 92, 246, 180],   // violet-500 semi-transparent
    getLineColor: [167, 139, 250, 255],  // violet-400 solid
    lineWidthMinPixels: 2,
    parameters: { depthTest: true },
    onHover,
  })
}
