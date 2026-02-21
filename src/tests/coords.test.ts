import { describe, it, expect } from 'vitest'
import { wgs84ToOsgb, osgbToWgs84, bboxWgs84ToOsgb, geometryToOsgb, polygonToOsgbCoords } from '@/lib/coords'

describe('coords', () => {
  describe('wgs84ToOsgb', () => {
    it('converts Big Ben to approximate BNG coordinates (±500m tolerance)', () => {
      // Big Ben: 51.5007°N, 0.1246°W
      // Helmert 7-parameter transform has ~10-100m accuracy vs OSTN15 grid shift
      const [e, n] = wgs84ToOsgb(-0.1246, 51.5007)
      expect(e).toBeCloseTo(530268, -3)  // ~530268 easting  (tolerance ±500)
      expect(n).toBeCloseTo(179640, -3)  // ~179640 northing (tolerance ±500)
    })

    it('converts Edinburgh Castle to approximate BNG (±500m tolerance)', () => {
      // Edinburgh Castle: 55.9486°N, 3.1999°W
      const [e, n] = wgs84ToOsgb(-3.1999, 55.9486)
      expect(e).toBeCloseTo(325164, -3)
      expect(n).toBeCloseTo(673200, -3)
    })
  })

  describe('osgbToWgs84 round-trip', () => {
    it('round-trips WGS84 → OSGB → WGS84 within 0.00001° tolerance', () => {
      const testPoints: [number, number][] = [
        [-0.1246, 51.5007],   // London
        [-3.1999, 55.9486],   // Edinburgh
        [-1.8905, 52.4862],   // Birmingham
        [-2.2426, 53.4808],   // Manchester
        [0.1155, 51.501],     // Thamesmead
      ]

      for (const [origLng, origLat] of testPoints) {
        const [e, n] = wgs84ToOsgb(origLng, origLat)
        const [roundLng, roundLat] = osgbToWgs84(e, n)
        expect(roundLng).toBeCloseTo(origLng, 4)
        expect(roundLat).toBeCloseTo(origLat, 4)
      }
    })
  })

  describe('bboxWgs84ToOsgb', () => {
    it('converts a WGS84 bbox to OSGB', () => {
      const bbox = bboxWgs84ToOsgb([-0.2, 51.4, 0.0, 51.6])
      expect(bbox.minX).toBeLessThan(bbox.maxX)
      expect(bbox.minY).toBeLessThan(bbox.maxY)
      expect(bbox.minX).toBeGreaterThan(500000) // central London area
      expect(bbox.maxX).toBeLessThan(560000)
    })
  })

  describe('geometryToOsgb', () => {
    it('transforms a Point geometry', () => {
      const point: GeoJSON.Point = { type: 'Point', coordinates: [-0.1246, 51.5007] }
      const result = geometryToOsgb(point) as GeoJSON.Point
      expect(result.type).toBe('Point')
      expect(result.coordinates[0]).toBeCloseTo(530268, -1)
    })

    it('transforms a Polygon geometry ring-by-ring', () => {
      const polygon: GeoJSON.Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-0.13, 51.50],
            [-0.12, 51.50],
            [-0.12, 51.51],
            [-0.13, 51.51],
            [-0.13, 51.50],
          ],
        ],
      }
      const result = geometryToOsgb(polygon) as GeoJSON.Polygon
      expect(result.type).toBe('Polygon')
      expect(result.coordinates[0]).toHaveLength(5)
      // Coordinates should now be in hundreds of thousands (easting/northing)
      expect(result.coordinates[0][0][0]).toBeGreaterThan(100000)
    })
  })

  describe('polygonToOsgbCoords', () => {
    it('extracts exterior ring coords from a polygon in OSGB', () => {
      const polygon: GeoJSON.Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [0.10, 51.50],
            [0.12, 51.50],
            [0.12, 51.51],
            [0.10, 51.51],
            [0.10, 51.50],
          ],
        ],
      }
      const coords = polygonToOsgbCoords(polygon)
      expect(coords).toHaveLength(5)
      expect(Array.isArray(coords[0])).toBe(true)
      expect(coords[0]).toHaveLength(2)
    })
  })
})
