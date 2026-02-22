import { GeoJsonLayer, PathLayer, TextLayer, LineLayer } from '@deck.gl/layers'
import * as turf from '@turf/turf'
import { CONSTRAINT_FILL_COLORS, CONSTRAINT_STROKE_COLORS } from '@/lib/colors'
import type { RgbaColor } from '@/lib/colors'
import { CONSTRAINT_TYPES, CONSTRAINT_LABELS } from '@/types/constraints'
import type { ConstraintType, StatutoryConstraints } from '@/types/constraints'
import type { Layer } from '@deck.gl/core'

const STRIPE_SPACING_DEG = 0.00025 // ≈ 25m perpendicular spacing at lat 51°
const LABEL_ELEVATION = 80        // metres above ground — above buildings, below sky

/** Short display names used when two types are combined in an overlap label */
const SHORT_LABEL: Record<ConstraintType, string> = {
  'green-belt': 'Green Belt',
  'conservation-area': 'Conservation',
  'article-4': 'Article 4',
  'flood-risk': 'Flood Risk',
}

/** Generate alternating-colour diagonal stripe paths within one intersection polygon */
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
      if (turf.booleanPointInPolygon([x, y], feature as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>)) {
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

type LabelPoint = {
  position: [number, number]
  text: string
  textColor: RgbaColor
  bgColor: RgbaColor
  lineColor: RgbaColor
}

/**
 * Builds all constraint deck.gl layers from the statutory constraints store value.
 *
 * 1. Computes pairwise intersections between every active constraint type pair.
 * 2. Subtracts intersection areas from each type's fill so solid fill only covers
 *    exclusive (non-overlapping) areas.
 * 3. Renders diagonal stripe bands in every overlap region (no background fill).
 * 4. Adds billboard TextLayer labels floating 80 m above each region with a
 *    vertical leader line so labels appear physically above the map in 3D.
 */
export function buildConstraintLayers(constraints: StatutoryConstraints): Layer[] {
  const layers: Layer[] = []

  const activeTypes = CONSTRAINT_TYPES.filter((type) => {
    const c = constraints[type]
    return c.intersects && c.features && c.features.features.length > 0
  })

  if (activeTypes.length === 0) return layers

  // ── Step 1: pairwise intersections ────────────────────────────────────────
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
      const flatA = turf.flatten(constraints[typeA].features! as GeoJSON.FeatureCollection)
      const flatB = turf.flatten(constraints[typeB].features! as GeoJSON.FeatureCollection)

      for (const fa of (flatA as any).features) {
        if (!fa?.geometry || (fa.geometry.type !== 'Polygon' && fa.geometry.type !== 'MultiPolygon')) continue
        for (const fb of (flatB as any).features) {
          if (!fb?.geometry || (fb.geometry.type !== 'Polygon' && fb.geometry.type !== 'MultiPolygon')) continue
          try {
            const inter = turf.intersect(turf.featureCollection([fa, fb] as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>[]))
            if (inter) intersectionRecords.push({ typeA, typeB, feature: inter })
          } catch { /* skip degenerate pairs */ }
        }
      }
    }
  }

  // ── Step 2: fill layers for exclusive (non-overlapping) areas ─────────────
  const safeFillByType = new Map<ConstraintType, GeoJSON.Feature>()

  for (const type of activeTypes) {
    const fc = constraints[type].features!
    const relevant = intersectionRecords.filter(
      (r) => r.typeA === type || r.typeB === type,
    )

    const pushFullLayer = () =>
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

    if (relevant.length === 0) {
      pushFullLayer()
      // No overlap — centroid of the original polygon is fine for the label
      try {
        safeFillByType.set(type, turf.centroid(turf.featureCollection(fc.features)) as GeoJSON.Feature)
      } catch { /* skip label */ }
      continue
    }

    let base: GeoJSON.Feature | null = null
    try {
      base = turf.union(turf.featureCollection(fc.features as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>[]))
    } catch {
      pushFullLayer()
      continue
    }

    let safeFill: GeoJSON.Feature | null = base
    for (const { feature: inter } of relevant) {
      if (!safeFill) break
      try {
        safeFill = turf.difference(turf.featureCollection([safeFill, inter] as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>[]))
      } catch { /* keep current safeFill */ }
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
      // Use centroid of the exclusive area for label placement
      try {
        safeFillByType.set(type, turf.centroid(safeFill as any) as GeoJSON.Feature)
      } catch { /* skip label */ }
    }
  }

  // ── Step 3: diagonal stripe bands for every overlap area ──────────────────
  type PairEntry = {
    typeA: ConstraintType
    typeB: ConstraintType
    stripePaths: Array<{ path: [number, number][]; color: RgbaColor }>
  }
  const pairMap = new Map<string, PairEntry>()

  for (const { typeA, typeB, feature } of intersectionRecords) {
    const key = `${typeA}|${typeB}`
    if (!pairMap.has(key)) pairMap.set(key, { typeA, typeB, stripePaths: [] })
    pairMap.get(key)!.stripePaths.push(
      ...generateStripes(
        feature,
        CONSTRAINT_STROKE_COLORS[typeA],
        CONSTRAINT_STROKE_COLORS[typeB],
      ),
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

  // ── Step 4: 3D floating labels ─────────────────────────────────────────────
  const labelPoints: LabelPoint[] = []

  // One label per exclusive constraint area
  for (const [type, centroidFeature] of safeFillByType.entries()) {
    const [lng, lat] = centroidFeature.geometry.type === 'Point'
      ? (centroidFeature.geometry as GeoJSON.Point).coordinates
      : [0, 0]
    const [r, g, b] = CONSTRAINT_STROKE_COLORS[type]
    labelPoints.push({
      position: [lng, lat],
      text: CONSTRAINT_LABELS[type],
      textColor: [255, 255, 255, 255],
      bgColor: [r, g, b, 200],
      lineColor: [r, g, b, 160],
    })
  }

  // One label per intersection feature
  for (const { typeA, typeB, feature } of intersectionRecords) {
    try {
      const c = turf.centroid(feature)
      const [lng, lat] = c.geometry.coordinates
      const [rA, gA, bA] = CONSTRAINT_STROKE_COLORS[typeA]
      const [rB, gB, bB] = CONSTRAINT_STROKE_COLORS[typeB]
      labelPoints.push({
        position: [lng, lat],
        text: `${SHORT_LABEL[typeA]} + ${SHORT_LABEL[typeB]}`,
        textColor: [255, 255, 255, 255],
        // Blend the two constraint colours for the overlap badge
        bgColor: [
          Math.round((rA + rB) / 2),
          Math.round((gA + gB) / 2),
          Math.round((bA + bB) / 2),
          220,
        ],
        lineColor: [
          Math.round((rA + rB) / 2),
          Math.round((gA + gB) / 2),
          Math.round((bA + bB) / 2),
          140,
        ],
      })
    } catch { /* skip if centroid fails */ }
  }

  if (labelPoints.length === 0) return layers

  // Vertical leader lines: ground (z=0) → label (z=LABEL_ELEVATION)
  layers.push(
    new LineLayer({
      id: 'constraint-label-stems',
      data: labelPoints,
      getSourcePosition: (d) => [d.position[0], d.position[1], 0],
      getTargetPosition: (d) => [d.position[0], d.position[1], LABEL_ELEVATION],
      getColor: (d) => d.lineColor,
      getWidth: 1.5,
      widthUnits: 'pixels',
      parameters: { depthTest: false, depthMask: false },
    }),
  )

  // Billboard text labels floating at LABEL_ELEVATION metres
  layers.push(
    new TextLayer({
      id: 'constraint-labels',
      data: labelPoints,
      getPosition: (d) => [d.position[0], d.position[1], LABEL_ELEVATION],
      getText: (d) => d.text,
      getSize: 12,
      getColor: (d) => d.textColor,
      background: true,
      getBackgroundColor: (d) => d.bgColor,
      backgroundPadding: [8, 4, 8, 4],
      billboard: true,
      sizeUnits: 'pixels',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontWeight: 700,
      fontSettings: { sdf: true },
      outlineColor: [0, 0, 0, 160],
      outlineWidth: 1.5,
      parameters: { depthTest: false, depthMask: false },
    }),
  )

  return layers
}
