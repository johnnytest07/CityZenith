/**
 * Market value hex layer — extruded hex grid coloured by relative price vs borough median.
 *
 * Colour scale:
 *   deep blue    score < -0.3  (undervalued)
 *   medium blue  -0.3 to -0.1
 *   grey         -0.1 to +0.1  (near median)
 *   amber        +0.1 to +0.3
 *   red-orange   score > +0.3  (overheated)
 */

import { GeoJsonLayer } from '@deck.gl/layers'

export type RgbaColor = [number, number, number, number]

export function scoreToColor(score: number | null | undefined): RgbaColor {
  if (score === null || score === undefined) return [0, 0, 0, 0]
  if (score < -0.3) return [30, 100, 210, 180]
  if (score < -0.1) return [90, 150, 220, 150]
  if (score <= 0.1) return [120, 120, 130, 100]
  if (score <= 0.3) return [220, 150, 50, 160]
  return [210, 65, 30, 190]
}

export function createMarketValueLayer(
  hexGrid: GeoJSON.FeatureCollection,
): GeoJsonLayer {
  return new GeoJsonLayer({
    id: 'market-value-hex',
    data: hexGrid,
    pickable: true,
    extruded: true,
    filled: true,
    stroked: false,
    opacity: 0.55,
    getElevation: (f: GeoJSON.Feature) =>
      Math.abs((f.properties?.relativeScore as number | null | undefined) ?? 0) * 120,
    getFillColor: (f: GeoJSON.Feature) =>
      scoreToColor(f.properties?.relativeScore as number | null | undefined),
    parameters: { depthTest: true },
    updateTriggers: {
      getElevation: [hexGrid],
      getFillColor: [hexGrid],
    },
  })
}
