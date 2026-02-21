export type AmenityCategory =
  | 'bus_stop'
  | 'train_station'
  | 'subway_station'
  | 'supermarket'
  | 'convenience'
  | 'gym'
  | 'park'
  | 'school'
  | 'restaurant'
  | 'fast_food'
  | 'cafe'
  | 'pub'
  | 'pharmacy'
  | 'hospital'

export interface NearbyAmenity {
  category: AmenityCategory
  name: string
  distanceM: number
  /** Extra descriptor: transport line, shop type, cuisine, school level, etc. */
  subtype?: string
  /** WGS84 coordinates for map flyTo and marker */
  lat: number
  lng: number
}

export interface AmenityGroup {
  label: string
  emoji: string
  categories: AmenityCategory[]
}

export const AMENITY_GROUPS: AmenityGroup[] = [
  {
    label: 'Rail & Tube',
    emoji: '🚆',
    categories: ['train_station', 'subway_station'],
  },
  {
    label: 'Bus',
    emoji: '🚌',
    categories: ['bus_stop'],
  },
  {
    label: 'Supermarket',
    emoji: '🛒',
    categories: ['supermarket', 'convenience'],
  },
  {
    label: 'Gym',
    emoji: '💪',
    categories: ['gym'],
  },
  {
    label: 'Park',
    emoji: '🌳',
    categories: ['park'],
  },
  {
    label: 'School',
    emoji: '🏫',
    categories: ['school'],
  },
  {
    label: 'Food & Drink',
    emoji: '🍽️',
    categories: ['restaurant', 'fast_food', 'cafe', 'pub'],
  },
  {
    label: 'Pharmacy',
    emoji: '💊',
    categories: ['pharmacy'],
  },
]
