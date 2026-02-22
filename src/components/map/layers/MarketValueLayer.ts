/**
 * Market value hex layer — extruded hex grid coloured by relative price vs borough median.
 *
 * Both height and colour encode the same variable (relative price), so the
 * visual reading is unambiguous: tall warm towers = premium, short cool cells = affordable.
 *
 * Height  (relativeScore ∈ [-1, +1] → 15 – 350 m):
 *   score +1  → 350 m   (far above borough median)
 *   score  0  → 183 m   (at borough median)
 *   score -1  →  15 m   (far below borough median, floor so cells remain visible)
 *
 * Colour scale (relative price vs borough median):
 *   deep blue    score < -0.3  (well below median — affordable)
 *   light blue   -0.3 to -0.1
 *   grey         -0.1 to +0.1  (near median)
 *   amber        +0.1 to +0.3
 *   red-orange   score > +0.3  (well above median — premium)
 *
 * Cells with fewer than 3 transactions (txCount === 0 / null) are hidden (alpha 0).
 */

import { GeoJsonLayer } from '@deck.gl/layers'

export type RgbaColor = [number, number, number, number]

export function scoreToColor(score: number | null | undefined): RgbaColor {
  if (score === null || score === undefined) return [0, 0, 0, 0]
  if (score < -0.3) return [30,  110, 220, 230]  // deep blue — undervalued
  if (score < -0.1) return [80,  160, 230, 210]  // medium blue
  if (score <= 0.1) return [155, 155, 165, 180]  // grey — near median
  if (score <= 0.3) return [230, 155,  35, 220]  // amber
  return                    [225,  60,  25, 235]  // red-orange — overheated
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
    getElevation: (f: GeoJSON.Feature) => {
      const score = (f.properties?.relativeScore as number | null) ?? null
      const txCount = (f.properties?.txCount as number | null) ?? 0
      if (score === null || txCount === 0) return 0
      // Both height and colour encode relative price so the reading is unambiguous.
      // score ∈ [-1, +1] → height ∈ [15, 350] m, with a floor so cells stay visible.
      return Math.max(15, (0.5 + score * 0.5) * 350)
    },
    getFillColor: (f: GeoJSON.Feature) =>
      scoreToColor(f.properties?.relativeScore as number | null | undefined),
    parameters: { depthTest: true },
    updateTriggers: {
      getElevation: [hexGrid],
      getFillColor: [hexGrid],
    },
  })
}
