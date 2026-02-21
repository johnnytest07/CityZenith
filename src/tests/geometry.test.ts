import { describe, it, expect } from 'vitest'
import { bufferClickPoint, bufferCentroid, bufferGeometry, getCentroid } from '@/lib/geometry'

describe('geometry', () => {
  describe('bufferClickPoint', () => {
    it('returns a Polygon feature', () => {
      const result = bufferClickPoint([0.115, 51.501])
      expect(result.type).toBe('Feature')
      expect(result.geometry.type).toBe('Polygon')
    })

    it('produces a polygon with coordinates', () => {
      const result = bufferClickPoint([0.115, 51.501], 0.1)
      const coords = (result.geometry as GeoJSON.Polygon).coordinates[0]
      expect(coords.length).toBeGreaterThan(10)
    })
  })

  describe('bufferCentroid', () => {
    it('returns a 50m circle as Polygon', () => {
      const result = bufferCentroid([0.115, 51.501])
      expect(result.type).toBe('Feature')
      expect(result.geometry.type).toBe('Polygon')
    })

    it('is smaller than bufferClickPoint default', () => {
      const small = bufferCentroid([0.115, 51.501], 0.05)
      const large = bufferClickPoint([0.115, 51.501], 0.1)

      // Compare bbox extents — 50m should be smaller than 100m
      const smallCoords = (small.geometry as GeoJSON.Polygon).coordinates[0]
      const largeCoords = (large.geometry as GeoJSON.Polygon).coordinates[0]

      const extent = (coords: number[][]) => {
        const lngs = coords.map((c) => c[0])
        return Math.max(...lngs) - Math.min(...lngs)
      }

      expect(extent(smallCoords)).toBeLessThan(extent(largeCoords))
    })
  })

  describe('bufferGeometry', () => {
    it('buffers a polygon geometry', () => {
      const polygon: GeoJSON.Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [0.11, 51.50],
            [0.12, 51.50],
            [0.12, 51.51],
            [0.11, 51.51],
            [0.11, 51.50],
          ],
        ],
      }
      const result = bufferGeometry(polygon, 0.1)
      expect(result).not.toBeNull()
      expect(['Polygon', 'MultiPolygon']).toContain(result?.geometry.type)
    })

    it('returns null-safe on invalid input', () => {
      // Should not throw — returns null for unusable geometry
      const point: GeoJSON.Point = { type: 'Point', coordinates: [0.115, 51.501] }
      expect(() => bufferGeometry(point, 0.1)).not.toThrow()
    })
  })

  describe('getCentroid', () => {
    it('returns centroid of a polygon', () => {
      const polygon: GeoJSON.Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [0.0, 0.0],
            [1.0, 0.0],
            [1.0, 1.0],
            [0.0, 1.0],
            [0.0, 0.0],
          ],
        ],
      }
      const [lng, lat] = getCentroid(polygon)
      expect(lng).toBeCloseTo(0.5, 1)
      expect(lat).toBeCloseTo(0.5, 1)
    })
  })
})
