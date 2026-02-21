import type { Map as MapLibreMap } from 'maplibre-gl'
import type { NearbyContextFeatures } from '@/types/siteContext'

const QUERY_RADIUS_M = 250

/**
 * Extract raw building and land use features from MapLibre's loaded
 * OSM vector tiles within QUERY_RADIUS_M of the site centre.
 *
 * Uses map.queryRenderedFeatures() which reads from already-loaded tiles —
 * no additional API call needed.
 *
 * Returns raw GeoJSON FeatureCollections only.
 * No computation, no aggregation, no derived values.
 */
export function extractNearbyFeatures(
  map: MapLibreMap,
  siteCenter: [number, number],
  radiusM: number = QUERY_RADIUS_M,
): NearbyContextFeatures {
  // Convert radius in metres to approximate pixel radius at current zoom.
  // At zoom 14, 1 pixel ≈ 10m. Use a conservative multiplier.
  const zoom = map.getZoom()
  const metersPerPixel = (156543.03392 * Math.cos((siteCenter[1] * Math.PI) / 180)) / Math.pow(2, zoom)
  const pixelRadius = Math.ceil(radiusM / metersPerPixel)

  // Project site centre to screen pixels
  const centerPx = map.project(siteCenter as [number, number])

  const sw: [number, number] = [centerPx.x - pixelRadius, centerPx.y + pixelRadius]
  const ne: [number, number] = [centerPx.x + pixelRadius, centerPx.y - pixelRadius]

  // Filter candidate layer names to only those that exist in the current style.
  // queryRenderedFeatures throws if any named layer is absent.
  const styleLayerIds = new Set(map.getStyle().layers.map((l) => l.id))
  const existingLayers = (candidates: string[]) => candidates.filter((id) => styleLayerIds.has(id))

  const buildingLayerIds = existingLayers(['building-3d', 'building', '3d-buildings'])
  const landuseLayerIds = existingLayers(['landuse', 'landuse-overlay', 'land-use'])

  // Query building features
  const buildingFeatures = buildingLayerIds.length > 0
    ? map.queryRenderedFeatures([sw, ne], { layers: buildingLayerIds })
    : []

  // Query land use features
  const landuseFeatures = landuseLayerIds.length > 0
    ? map.queryRenderedFeatures([sw, ne], { layers: landuseLayerIds })
    : []

  // Deduplicate by feature id (tiles can return the same feature multiple times)
  const dedupeFeatures = (features: maplibregl.MapGeoJSONFeature[]): GeoJSON.Feature[] => {
    const seen = new Set<string>()
    return features.filter((f) => {
      const key = f.id != null ? String(f.id) : JSON.stringify(f.geometry)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  return {
    buildings: {
      type: 'FeatureCollection',
      features: dedupeFeatures(buildingFeatures),
    },
    landuse: {
      type: 'FeatureCollection',
      features: dedupeFeatures(landuseFeatures),
    },
    queryRadiusM: radiusM,
  }
}
