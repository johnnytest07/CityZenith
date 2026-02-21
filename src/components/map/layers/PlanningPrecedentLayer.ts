import { GeoJsonLayer } from '@deck.gl/layers'
import type { Layer } from '@deck.gl/core'
import { getDecisionFillColor, getDecisionStrokeColor } from '@/lib/colors'
import type { RgbaColor } from '@/lib/colors'

/**
 * Classify a normalised_decision string into one of three buckets.
 * Each bucket maps to its own layer with a distinct polygon offset so there
 * is never any z-fighting between overlapping circles.
 *
 *   Slot 0 — undetermined  (renders first / bottommost)
 *   Slot 1 — approved      (renders second)
 *   Slot 2 — refused       (renders last / topmost)
 */
function decisionSlot(decision: string | null): 0 | 1 | 2 {
  if (!decision) return 0
  const d = decision.toLowerCase()
  if (d.includes('approv')) return 1
  if (d.includes('refus') || d.includes('reject')) return 2
  return 0
}

const SLOT_IDS = ['undetermined', 'approved', 'refused'] as const

// Base polygon offset per decision slot.
// Each slot's base is separated by 500 units so no amount of per-feature
// stepping can bridge the gap between different decision types.
const SLOT_BASE_OFFSETS: [number, number][] = [
  [0, 0],         // undetermined — base level
  [-2, -500],     // approved     — well above undetermined
  [-4, -1000],    // refused      — well above approved
]

/**
 * Factory for the planning precedent deck.gl layers.
 *
 * Returns THREE GeoJsonLayers — one per decision bucket — each assigned a
 * unique getPolygonOffset so they never share the same GL depth level.
 * The layers are ordered bottom → top: undetermined, approved, refused.
 */
export function createPlanningPrecedentLayer(
  data: GeoJSON.FeatureCollection,
  onFeatureClick?: (feature: GeoJSON.Feature) => void,
): Layer[] {
  // Partition features into three buckets
  const buckets: GeoJSON.Feature[][] = [[], [], []]
  for (const f of data.features) {
    buckets[decisionSlot(f.properties?.normalised_decision as string | null)].push(f)
  }

  return SLOT_IDS.map((slotName, slotIndex) => {
    const features = buckets[slotIndex]
    const slotData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features,
    }
    const [baseFactor, baseUnits] = SLOT_BASE_OFFSETS[slotIndex]

    // Build a lookup from feature object → its index within this bucket so we
    // can give every feature its own unique depth level inside the slot.
    const featureIndexMap = new Map<GeoJSON.Feature, number>(
      features.map((f, i) => [f, i]),
    )

    return new GeoJsonLayer({
      id: `planning-precedent-${slotName}`,
      data: slotData,
      pickable: true,
      stroked: true,
      filled: true,
      extruded: false,

      // Per-feature offset: each feature within a bucket gets a unique level
      // (stepped by 1 factor / 10 units) so overlapping circles never fight.
      // The slot base is spaced 500 units apart so no intra-bucket stepping
      // can bleed across into another decision bucket.
      getPolygonOffset: (f: GeoJSON.Feature): [number, number] => {
        const i = featureIndexMap.get(f) ?? 0
        return [baseFactor - i * 0.5, baseUnits - i * 10]
      },

      // depthTest off so layers don't occlude the basemap or each other;
      // depthMask off so they don't write to the depth buffer.
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
        const d = (f.properties?.normalised_decision as string | null)?.toLowerCase() ?? ''
        const isRefused = d.includes('refus') || d.includes('reject')
        // Refused circles get a thicker outline so the red ring stays visible
        // even when an approved (green) circle occupies the same location.
        if (isRefused) return 3
        return f.properties?.geometrySource === 'buffered-centroid' ? 1 : 2
      },

      lineWidthMinPixels: 1,
      lineWidthMaxPixels: 5,
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
  })
}
