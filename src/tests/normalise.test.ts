import { describe, it, expect } from 'vitest'
import { normaliseApplicationsToFeatures } from '@/lib/normalise'
import type { PlanningApplication } from '@/types/ibex'

// WKT strings in EPSG:27700 (British National Grid)
// These are real OSGB coords near central London / Thamesmead
const WKT_POLYGON =
  'POLYGON((530000 179000, 530100 179000, 530100 179100, 530000 179100, 530000 179000))'
const WKT_POINT = 'POINT(530268 179640)'  // Big Ben area

function makeApp(overrides: Partial<PlanningApplication> = {}): PlanningApplication {
  return {
    planning_reference: 'TEST/001/2024',
    proposal: 'Erection of 10 dwellings',
    normalised_decision: 'Approved',
    raw_decision: 'Approved',
    geometry: null,
    centre_point: null,
    council_id: 240,
    council_name: 'London Borough of Greenwich',
    normalised_application_type: 'Full Planning Permission',
    application_date: '2023-01-10',
    decided_date: '2023-06-15',
    classifications: ['Residential'],
    appeal_decision: null,
    appeal_date: null,
    heading: null,
    num_new_houses: null,
    url: null,
    raw_address: null,
    ...overrides,
  }
}

describe('normaliseApplicationsToFeatures', () => {
  it('returns a FeatureCollection', () => {
    const result = normaliseApplicationsToFeatures([makeApp({ centre_point: WKT_POINT })])
    expect(result.type).toBe('FeatureCollection')
    expect(Array.isArray(result.features)).toBe(true)
  })

  it('normalises centre_point app to buffered polygon', () => {
    const app = makeApp({ geometry: null, centre_point: WKT_POINT })
    const result = normaliseApplicationsToFeatures([app])
    expect(result.features).toHaveLength(1)
    const f = result.features[0]
    expect(f.geometry.type).toBe('Polygon')
    expect(f.properties?.geometrySource).toBe('buffered-centroid')
  })

  it('preserves WKT polygon geometry as application-geometry', () => {
    const app = makeApp({ geometry: WKT_POLYGON })
    const result = normaliseApplicationsToFeatures([app])
    expect(result.features).toHaveLength(1)
    const f = result.features[0]
    expect(f.geometry.type).toBe('Polygon')
    expect(f.properties?.geometrySource).toBe('application-geometry')
  })

  it('buffers a WKT Point geometry to a polygon', () => {
    const app = makeApp({ geometry: WKT_POINT })
    const result = normaliseApplicationsToFeatures([app])
    expect(result.features).toHaveLength(1)
    expect(result.features[0].geometry.type).toBe('Polygon')
    expect(result.features[0].properties?.geometrySource).toBe('buffered-centroid')
  })

  it('skips apps with no geometry and no centre_point', () => {
    const app = makeApp({ geometry: null, centre_point: null })
    const result = normaliseApplicationsToFeatures([app])
    expect(result.features).toHaveLength(0)
  })

  it('preserves all application properties in feature', () => {
    const app = makeApp({ geometry: WKT_POLYGON })
    const result = normaliseApplicationsToFeatures([app])
    const props = result.features[0].properties
    expect(props?.planning_reference).toBe('TEST/001/2024')
    expect(props?.proposal).toBe('Erection of 10 dwellings')
    expect(props?.normalised_decision).toBe('Approved')
    expect(props?.council_id).toBe(240)
    expect(props?.application_date).toBe('2023-01-10')
    expect(props?.decided_date).toBe('2023-06-15')
  })

  it('handles mixed array of apps', () => {
    const apps = [
      makeApp({ planning_reference: 'A', geometry: null, centre_point: WKT_POINT }),
      makeApp({ planning_reference: 'B', geometry: WKT_POLYGON }),
      makeApp({ planning_reference: 'C', geometry: null, centre_point: null }),
    ]
    const result = normaliseApplicationsToFeatures(apps)
    // C has no geometry — skipped
    expect(result.features).toHaveLength(2)
    const refs = result.features.map((f) => f.properties?.planning_reference)
    expect(refs).toContain('A')
    expect(refs).toContain('B')
  })

  it('converts WKT coords from EPSG:27700 to WGS84', () => {
    // POINT(530268 179640) is Big Ben in OSGB → should be near -0.1246, 51.5007 in WGS84
    const app = makeApp({ geometry: WKT_POINT })
    const result = normaliseApplicationsToFeatures([app])
    // buffered-centroid polygon — centroid should be near Big Ben in WGS84
    expect(result.features).toHaveLength(1)
    // The resulting polygon coordinates should be in WGS84 range (lng ~ -0.1, lat ~ 51.5)
    const coords = (result.features[0].geometry as GeoJSON.Polygon).coordinates[0]
    const lngs = coords.map(([lng]) => lng)
    const lats = coords.map(([, lat]) => lat)
    expect(Math.min(...lngs)).toBeGreaterThan(-1)
    expect(Math.max(...lngs)).toBeLessThan(1)
    expect(Math.min(...lats)).toBeGreaterThan(51)
    expect(Math.max(...lats)).toBeLessThan(52)
  })
})
