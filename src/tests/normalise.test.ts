import { describe, it, expect } from 'vitest'
import { normaliseApplicationsToFeatures } from '@/lib/normalise'
import type { PlanningApplication } from '@/types/ibex'

function makeApp(overrides: Partial<PlanningApplication> = {}): PlanningApplication {
  return {
    planning_reference: 'TEST/001/2024',
    proposal: 'Erection of 10 dwellings',
    decision: 'Approved',
    normalised_decision: 'Approved',
    latitude: 51.501,
    longitude: 0.115,
    geometry: null,
    council_id: 'greenwich',
    normalised_application_type: 'Full Planning Permission',
    received_date: '2023-01-10',
    decision_date: '2023-06-15',
    classifications: ['Residential'],
    appeal_decision: null,
    appeal_date: null,
    ...overrides,
  }
}

describe('normaliseApplicationsToFeatures', () => {
  it('returns a FeatureCollection', () => {
    const result = normaliseApplicationsToFeatures([makeApp()])
    expect(result.type).toBe('FeatureCollection')
    expect(Array.isArray(result.features)).toBe(true)
  })

  it('normalises centroid-only app to buffered polygon', () => {
    const app = makeApp({ geometry: null, latitude: 51.501, longitude: 0.115 })
    const result = normaliseApplicationsToFeatures([app])
    expect(result.features).toHaveLength(1)
    const f = result.features[0]
    expect(f.geometry.type).toBe('Polygon')
    expect(f.properties?.geometrySource).toBe('buffered-centroid')
  })

  it('preserves application polygon geometry', () => {
    const polygon: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [[[0.11, 51.50], [0.12, 51.50], [0.12, 51.51], [0.11, 51.51], [0.11, 51.50]]],
    }
    const app = makeApp({ geometry: polygon as unknown as PlanningApplication['geometry'] })
    const result = normaliseApplicationsToFeatures([app])
    expect(result.features).toHaveLength(1)
    const f = result.features[0]
    expect(f.geometry.type).toBe('Polygon')
    expect(f.properties?.geometrySource).toBe('application-geometry')
  })

  it('buffers a Point geometry to polygon', () => {
    const point: GeoJSON.Point = { type: 'Point', coordinates: [0.115, 51.501] }
    const app = makeApp({ geometry: point as unknown as PlanningApplication['geometry'] })
    const result = normaliseApplicationsToFeatures([app])
    expect(result.features).toHaveLength(1)
    expect(result.features[0].geometry.type).toBe('Polygon')
    expect(result.features[0].properties?.geometrySource).toBe('buffered-centroid')
  })

  it('skips apps with no geometry and no lat/lng', () => {
    const app = makeApp({ geometry: null, latitude: null, longitude: null })
    const result = normaliseApplicationsToFeatures([app])
    expect(result.features).toHaveLength(0)
  })

  it('preserves all application properties in feature', () => {
    const app = makeApp()
    const result = normaliseApplicationsToFeatures([app])
    const props = result.features[0].properties
    expect(props?.planning_reference).toBe('TEST/001/2024')
    expect(props?.proposal).toBe('Erection of 10 dwellings')
    expect(props?.normalised_decision).toBe('Approved')
    expect(props?.council_id).toBe('greenwich')
  })

  it('handles mixed array of apps', () => {
    const apps = [
      makeApp({ planning_reference: 'A', geometry: null, latitude: 51.5, longitude: 0.1 }),
      makeApp({
        planning_reference: 'B',
        geometry: {
          type: 'Polygon',
          coordinates: [[[0.11, 51.50], [0.12, 51.50], [0.12, 51.51], [0.11, 51.50]]],
        } as unknown as PlanningApplication['geometry'],
      }),
      makeApp({ planning_reference: 'C', geometry: null, latitude: null, longitude: null }),
    ]
    const result = normaliseApplicationsToFeatures(apps)
    // C has no geometry — skipped
    expect(result.features).toHaveLength(2)
    const refs = result.features.map((f) => f.properties?.planning_reference)
    expect(refs).toContain('A')
    expect(refs).toContain('B')
  })
})
