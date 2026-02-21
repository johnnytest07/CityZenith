import type { NearbyAmenity, AmenityCategory } from '@/types/amenities'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const RADIUS_M = 1000

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function classifyTags(tags: Record<string, string>): AmenityCategory | null {
  const { amenity, shop, leisure, railway, public_transport } = tags

  if (amenity === 'bus_stop') return 'bus_stop'
  if (public_transport === 'stop_position' && tags.bus === 'yes') return 'bus_stop'

  // Classify stations — subway takes precedence over generic train
  if (railway === 'station' || railway === 'halt') {
    if (tags.subway === 'yes') return 'subway_station'
    return 'train_station'
  }
  if (public_transport === 'station') {
    if (tags.subway === 'yes') return 'subway_station'
    return 'train_station'
  }
  if (amenity === 'subway_entrance') return 'subway_station'

  if (shop === 'supermarket') return 'supermarket'
  if (shop === 'grocery' || shop === 'convenience') return 'convenience'
  if (leisure === 'fitness_centre' || amenity === 'gym') return 'gym'
  if (leisure === 'park') return 'park'
  if (amenity === 'school') return 'school'
  if (amenity === 'restaurant') return 'restaurant'
  if (amenity === 'fast_food') return 'fast_food'
  if (amenity === 'cafe') return 'cafe'
  if (amenity === 'pub' || amenity === 'bar') return 'pub'
  if (amenity === 'pharmacy') return 'pharmacy'
  if (amenity === 'hospital') return 'hospital'
  return null
}

/** Detect the specific transport mode from OSM tags (London-aware). */
function getTransportSubtype(tags: Record<string, string>): string | undefined {
  const network = (tags.network ?? '').toLowerCase()
  const operator = (tags.operator ?? '').toLowerCase()
  const name = (tags.name ?? '').toLowerCase()

  if (
    network.includes('elizabeth') ||
    operator.includes('elizabeth') ||
    name.includes('elizabeth line')
  ) return 'Elizabeth line'

  if (
    network.includes('overground') ||
    operator.includes('overground') ||
    name.includes('overground')
  ) return 'Overground'

  if (
    network.includes('dlr') ||
    operator.includes('dlr') ||
    name.includes('dlr')
  ) return 'DLR'

  if (
    tags.subway === 'yes' ||
    network.includes('underground') ||
    network.includes('tube')
  ) return 'Tube'

  if (
    network.includes('tram') ||
    tags.tram === 'yes' ||
    operator.includes('tram')
  ) return 'Tram'

  if (tags.railway === 'station' || tags.railway === 'halt') return 'Train'
  return undefined
}

/** Detect school level from OSM tags and name keywords. */
function getSchoolSubtype(tags: Record<string, string>): string | undefined {
  const schoolType = (tags['school:type'] ?? tags['isced:level'] ?? '').toLowerCase()
  const name = (tags.name ?? '').toLowerCase()

  if (
    schoolType.includes('primary') ||
    name.includes('primary') ||
    name.includes('junior') ||
    name.includes('infant') ||
    name.includes('nursery')
  ) return 'Primary'

  if (
    schoolType.includes('secondary') ||
    name.includes('secondary') ||
    name.includes('high school') ||
    name.includes('upper school') ||
    (/\bacademy\b/.test(name) && !name.includes('primary'))
  ) return 'Secondary'

  if (schoolType.includes('special') || name.includes('special')) return 'Special'
  return undefined
}

/** Format a cuisine tag to human-readable. */
function formatCuisine(cuisine: string): string {
  return cuisine
    .split(';')[0]
    .trim()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Extract the relevant subtype descriptor for a classified amenity. */
function getSubtype(category: AmenityCategory, tags: Record<string, string>): string | undefined {
  switch (category) {
    case 'train_station':
    case 'subway_station':
      return getTransportSubtype(tags)
    case 'supermarket':
      return 'Supermarket'
    case 'convenience':
      return 'Convenience store'
    case 'school':
      return getSchoolSubtype(tags)
    case 'restaurant':
      return tags.cuisine ? formatCuisine(tags.cuisine) : undefined
    case 'fast_food':
      return tags.cuisine ? formatCuisine(tags.cuisine) : 'Fast food'
    case 'pub':
      return tags.amenity === 'bar' ? 'Bar' : undefined
    default:
      return undefined
  }
}

/** Fallback name when OSM has no name tag. */
function fallbackName(category: AmenityCategory): string {
  const names: Record<AmenityCategory, string> = {
    bus_stop: 'Bus Stop',
    train_station: 'Station',
    subway_station: 'Station',
    supermarket: 'Supermarket',
    convenience: 'Local Shop',
    gym: 'Gym',
    park: 'Local Green Space',
    school: 'School',
    restaurant: 'Restaurant',
    fast_food: 'Fast Food',
    cafe: 'Café',
    pub: 'Pub',
    pharmacy: 'Pharmacy',
    hospital: 'Hospital',
  }
  return names[category]
}

interface OverpassElement {
  type: string
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

/**
 * Queries the Overpass API for amenities within 1km of the given point.
 * Returns amenities sorted by distance ascending, with lat/lng and subtype.
 */
export async function fetchNearbyAmenities(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<NearbyAmenity[]> {
  const query = `[out:json][timeout:20];
(
  node["amenity"="bus_stop"](around:${RADIUS_M},${lat},${lng});
  node["railway"="station"](around:${RADIUS_M},${lat},${lng});
  way["railway"="station"](around:${RADIUS_M},${lat},${lng});
  node["railway"="halt"](around:${RADIUS_M},${lat},${lng});
  node["public_transport"="station"](around:${RADIUS_M},${lat},${lng});
  node["amenity"="subway_entrance"](around:${RADIUS_M},${lat},${lng});
  node["shop"="supermarket"](around:${RADIUS_M},${lat},${lng});
  node["shop"="grocery"](around:${RADIUS_M},${lat},${lng});
  node["shop"="convenience"](around:${RADIUS_M},${lat},${lng});
  node["leisure"="fitness_centre"](around:${RADIUS_M},${lat},${lng});
  node["amenity"="gym"](around:${RADIUS_M},${lat},${lng});
  node["leisure"="park"](around:${RADIUS_M},${lat},${lng});
  way["leisure"="park"](around:${RADIUS_M},${lat},${lng});
  node["amenity"="school"](around:${RADIUS_M},${lat},${lng});
  node["amenity"="restaurant"](around:600,${lat},${lng});
  node["amenity"="fast_food"](around:600,${lat},${lng});
  node["amenity"="cafe"](around:600,${lat},${lng});
  node["amenity"="pub"](around:600,${lat},${lng});
  node["amenity"="bar"](around:600,${lat},${lng});
  node["amenity"="pharmacy"](around:${RADIUS_M},${lat},${lng});
);
out center;`

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: query,
    headers: { 'Content-Type': 'text/plain' },
    signal,
  })

  if (!res.ok) throw new Error(`Overpass API error: ${res.status}`)

  const data = await res.json() as { elements: OverpassElement[] }

  const amenities: NearbyAmenity[] = []

  for (const el of data.elements) {
    const tags = el.tags ?? {}
    const category = classifyTags(tags)
    if (!category) continue

    const elLat = el.lat ?? el.center?.lat
    const elLng = el.lon ?? el.center?.lon
    if (elLat == null || elLng == null) continue

    // Skip unnamed parks — OSM often tags unnamed green patches that clutter the list
    if (category === 'park' && !tags.name) continue

    const distanceM = Math.round(haversineM(lat, lng, elLat, elLng))
    const name = tags.name ?? tags['name:en'] ?? fallbackName(category)
    const subtype = getSubtype(category, tags)

    amenities.push({ category, name, distanceM, subtype, lat: elLat, lng: elLng })
  }

  // Sort by distance; deduplicate by name+category (OSM can have duplicate nodes)
  const seen = new Set<string>()
  return amenities
    .sort((a, b) => a.distanceM - b.distanceM)
    .filter((a) => {
      const key = `${a.category}:${a.name.toLowerCase()}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}
