export type ConstraintType =
  | 'green-belt'
  | 'conservation-area'
  | 'article-4'
  | 'flood-risk'

export const CONSTRAINT_TYPES: ConstraintType[] = [
  'green-belt',
  'conservation-area',
  'article-4',
  'flood-risk',
]

export const CONSTRAINT_LABELS: Record<ConstraintType, string> = {
  'green-belt': 'Green Belt',
  'conservation-area': 'Conservation Area',
  'article-4': 'Article 4 Direction',
  'flood-risk': 'Flood Risk Zone',
}

export const CONSTRAINT_SOURCES: Record<ConstraintType, string> = {
  'green-belt': 'planning.data.gov.uk',
  'conservation-area': 'planning.data.gov.uk',
  'article-4': 'planning.data.gov.uk',
  'flood-risk': 'Environment Agency',
}

export interface ConstraintLayerState {
  intersects: boolean
  features: GeoJSON.FeatureCollection | null
  isLoading: boolean
}

export type StatutoryConstraints = Record<ConstraintType, ConstraintLayerState>

export function emptyConstraints(): StatutoryConstraints {
  const result = {} as StatutoryConstraints
  for (const type of CONSTRAINT_TYPES) {
    result[type] = { intersects: false, features: null, isLoading: false }
  }
  return result
}
