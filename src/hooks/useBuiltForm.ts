import type { Map as MapLibreMap } from 'maplibre-gl'
import { extractNearbyFeatures } from '@/lib/builtForm'
import { getCentroid } from '@/lib/geometry'
import type { NearbyContextFeatures } from '@/types/siteContext'

/**
 * Extract raw nearby building and land use features from MapLibre vector tiles.
 *
 * Plain async function (not a React hook) — called by useSiteSelection.
 * Returns raw GeoJSON FeatureCollections only. No computation.
 */
export function getBuiltFormFeatures(
  map: MapLibreMap,
  siteGeometry: GeoJSON.Geometry,
): NearbyContextFeatures {
  const center = getCentroid(siteGeometry) as [number, number]
  return extractNearbyFeatures(map, center, 250)
}
