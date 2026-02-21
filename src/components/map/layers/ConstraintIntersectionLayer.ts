import { GeoJsonLayer, PathLayer } from '@deck.gl/layers'
import * as turf from '@turf/turf'
import { CONSTRAINT_FILL_COLORS, CONSTRAINT_STROKE_COLORS } from '@/lib/colors'
import type { RgbaColor } from '@/lib/colors'
import { CONSTRAINT_TYPES } from '@/types/constraints'
import type { ConstraintType, StatutoryConstraints } from '@/types/constraints'
import type { Layer } from '@deck.gl/core'

const STRIPE_SPACING_DEG = 0.00025 // ≈ 25m perpendicular spacing at lat 51°

/**
 * Sweep 45° diagonal lines across an intersection polygon and return alternating-
 * colour path segments — one colour per constraint type.
 */
function generateStripes(
  feature: GeoJSON.Feature,
  colorA: RgbaColor,
  colorB: RgbaColor,
): Array<{ path: [number, number][]; color: RgbaColor }> {
  const paths: Array<{ path: [number, number][]; color: RgbaColor }> = []

  const bbox = turf.bbox(feature)
  const [minX, minY, maxX, maxY] = bbox
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const diag = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2) * 1.2

  // 45° bands: x + y = val. Perpendicular spacing = STRIPE_SPACING_DEG × √2.
  const bandStep = STRIPE_SPACING_DEG * Math.SQRT2
  const valMin = cx + cy - diag
  const valMax = cx + cy + diag

  let stripeIdx = 0

  for (let val = valMin; val <= valMax; val += bandStep) {
    const sampleN = Math.max(12, Math.round(diag / (STRIPE_SPACING_DEG * 2)))
    const x0 = cx - diag
    const dx = (2 * diag) / sampleN
    const color = stripeIdx % 2 === 0 ? colorA : colorB

    let current: [number, number][] = []

    for (let s = 0; s <= sampleN; s++) {
      const x = x0 + s * dx
      const y = val - x
      const inside = turf.booleanPointInPolygon([x, y], feature)
      if (inside) {
        current.push([x, y])
      } else {
        if (current.length >= 2) paths.push({ path: current, color })
        current = []
      }
    }
    if (current.length >= 2) paths.push({ path: current, color })

    stripeIdx++
  }

  return paths
}

/**
 * Builds all constraint deck.gl layers from the statutory constraints store value.
 *
 * Algorithm:
 *  1. Compute pairwise intersections between every pair of active constraint types.
 *  2. For each active type, subtract all intersection areas from its fill polygon
 *     so the plain fill only covers non-overlapping regions.
 *  3. For each intersection area, render alternating diagonal stripe bands instead
 *     of any solid fill — so overlaps are visually distinct with no background fill.
 */
export function buildConstraintLayers(constraints: StatutoryConstraints): Layer[] {
  const layers: Layer[] = []

  const activeTypes = CONSTRAINT_TYPES.filter((type) => {
    const c = constraints[type]
    return c.intersects && c.features && c.features.features.length > 0
  })

  if (activeTypes.length === 0) return layers

  // --- Step 1: compute all pairwise intersection features ---
  type IntersectionRecord = {
    typeA: ConstraintType
    typeB: ConstraintType
    feature: GeoJSON.Feature
  }
  const intersectionRecords: IntersectionRecord[] = []

  for (let i = 0; i < activeTypes.length; i++) {
    for (let j = i + 1; j < activeTypes.length; j++) {
      const typeA = activeTypes[i]
      const typeB = activeTypes[j]
      const flatA = turf.flatten(constraints[typeA].features! as turf.FeatureCollection)
      const flatB = turf.flatten(constraints[typeB].features! as turf.FeatureCollection)

      for (const fa of flatA.features) {
        for (const fb of flatB.features) {
          try {
            const inter = turf.intersect(turf.featureCollection([fa, fb]))
            if (inter) intersectionRecords.push({ typeA, typeB, feature: inter })
          } catch {
            // skip degenerate geometry pairs
          }
        }
      }
    }
  }

  // --- Step 2: render fills only for non-overlapping areas ---
  for (const type of activeTypes) {
    const fc = constraints[type].features!

    const relevant = intersectionRecords.filter(
      (r) => r.typeA === type || r.typeB === type,
    )

    if (relevant.length === 0) {
      // No overlaps — render the full fill as normal
      layers.push(
        new GeoJsonLayer({
          id: `constraint-${type}`,
          data: fc,
          pickable: false,
          filled: true,
          stroked: true,
          getFillColor: CONSTRAINT_FILL_COLORS[type],
          getLineColor: CONSTRAINT_STROKE_COLORS[type],
          getLineWidth: 2,
          lineWidthMinPixels: 1,
          lineWidthMaxPixels: 3,
          lineWidthUnits: 'pixels',
          parameters: { depthTest: false, depthMask: false },
        }),
      )
      continue
    }

    // Union all features of this type into a single geometry before differencing
    let base: GeoJSON.Feature | null = null
    try {
      base = turf.union(turf.featureCollection(fc.features as turf.Feature[]))
    } catch {
      // fall back to rendering without subtraction
      layers.push(
        new GeoJsonLayer({
          id: `constraint-${type}`,
          data: fc,
          pickable: false,
          filled: true,
          stroked: true,
          getFillColor: CONSTRAINT_FILL_COLORS[type],
          getLineColor: CONSTRAINT_STROKE_COLORS[type],
          getLineWidth: 2,
          lineWidthMinPixels: 1,
          lineWidthMaxPixels: 3,
          lineWidthUnits: 'pixels',
          parameters: { depthTest: false, depthMask: false },
        }),
      )
      continue
    }

    // Subtract each intersection area from the base polygon
    let safeFill: GeoJSON.Feature | null = base
    for (const { feature: inter } of relevant) {
      if (!safeFill) break
      try {
        const result = turf.difference(turf.featureCollection([safeFill, inter]))
        safeFill = result
      } catch {
        // if difference fails, keep current safeFill
      }
    }

    if (safeFill?.geometry) {
      layers.push(
        new GeoJsonLayer({
          id: `constraint-${type}`,
          data: { type: 'FeatureCollection', features: [safeFill] },
          pickable: false,
          filled: true,
          stroked: true,
          getFillColor: CONSTRAINT_FILL_COLORS[type],
          getLineColor: CONSTRAINT_STROKE_COLORS[type],
          getLineWidth: 2,
          lineWidthMinPixels: 1,
          lineWidthMaxPixels: 3,
          lineWidthUnits: 'pixels',
          parameters: { depthTest: false, depthMask: false },
        }),
      )
    }
  }

  // --- Step 3: render alternating stripe bands for every intersection area ---
  // Group records by typeA–typeB pair so each pair gets one PathLayer
  const pairMap = new Map<
    string,
    { typeA: ConstraintType; typeB: ConstraintType; stripePaths: Array<{ path: [number, number][]; color: RgbaColor }> }
  >()

  for (const { typeA, typeB, feature } of intersectionRecords) {
    const key = `${typeA}|${typeB}`
    if (!pairMap.has(key)) {
      pairMap.set(key, { typeA, typeB, stripePaths: [] })
    }
    const entry = pairMap.get(key)!
    entry.stripePaths.push(
      ...generateStripes(feature, CONSTRAINT_STROKE_COLORS[typeA], CONSTRAINT_STROKE_COLORS[typeB]),
    )
  }

  for (const { typeA, typeB, stripePaths } of pairMap.values()) {
    if (stripePaths.length === 0) continue
    layers.push(
      new PathLayer({
        id: `constraint-intersection-${typeA}-${typeB}`,
        data: stripePaths,
        getPath: (d) => d.path,
        getColor: (d) => d.color,
        getWidth: 5,
        widthUnits: 'pixels',
        widthMinPixels: 3,
        widthMaxPixels: 8,
        parameters: { depthTest: false, depthMask: false },
      }),
    )
  }

  return layers
}
