import proj4 from 'proj4'

// Register British National Grid (OSGB36 / EPSG:27700)
// Uses 7-parameter Helmert transform — sub-metre accuracy sufficient for MVP
proj4.defs(
  'EPSG:27700',
  '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 ' +
    '+x_0=400000 +y_0=-100000 +ellps=airy ' +
    '+towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 ' +
    '+units=m +no_defs',
)

/** WGS84 [lng, lat] → OSGB36 [easting, northing] */
export function wgs84ToOsgb(lng: number, lat: number): [number, number] {
  return proj4('EPSG:4326', 'EPSG:27700', [lng, lat]) as [number, number]
}

/** OSGB36 [easting, northing] → WGS84 [lng, lat] */
export function osgbToWgs84(easting: number, northing: number): [number, number] {
  return proj4('EPSG:27700', 'EPSG:4326', [easting, northing]) as [number, number]
}

/**
 * Convert a WGS84 bounding box to EPSG:27700.
 * bounds: [west, south, east, north] in WGS84 degrees
 */
export function bboxWgs84ToOsgb(
  bounds: [west: number, south: number, east: number, north: number],
): { minX: number; minY: number; maxX: number; maxY: number } {
  const [swE, swN] = wgs84ToOsgb(bounds[0], bounds[1])
  const [neE, neN] = wgs84ToOsgb(bounds[2], bounds[3])
  return { minX: swE, minY: swN, maxX: neE, maxY: neN }
}

/**
 * Transform a GeoJSON geometry's coordinates from WGS84 to EPSG:27700.
 * Returns a new geometry object — does not mutate the input.
 */
export function geometryToOsgb(geometry: GeoJSON.Geometry): GeoJSON.Geometry {
  switch (geometry.type) {
    case 'Point': {
      const [lng, lat] = geometry.coordinates as [number, number]
      const [e, n] = wgs84ToOsgb(lng, lat)
      return { type: 'Point', coordinates: [e, n] }
    }
    case 'Polygon': {
      const rings = (geometry.coordinates as number[][][]).map((ring) =>
        ring.map(([lng, lat]) => wgs84ToOsgb(lng, lat)),
      )
      return { type: 'Polygon', coordinates: rings }
    }
    case 'MultiPolygon': {
      const polys = (geometry.coordinates as number[][][][]).map((poly) =>
        poly.map((ring) => ring.map(([lng, lat]) => wgs84ToOsgb(lng, lat))),
      )
      return { type: 'MultiPolygon', coordinates: polys }
    }
    default:
      throw new Error(`Unsupported geometry type for coordinate transform: ${geometry.type}`)
  }
}

/**
 * Extract the exterior ring coordinate array from a polygon geometry in EPSG:27700.
 * Used to build the IBEX PolygonRequestSchema payload.
 */
export function polygonToOsgbCoords(geometry: GeoJSON.Geometry): number[][] {
  const osgb = geometryToOsgb(geometry)
  if (osgb.type === 'Polygon') {
    return osgb.coordinates[0] as number[][]
  }
  if (osgb.type === 'MultiPolygon') {
    // Use the largest ring of the first polygon
    return (osgb.coordinates[0] as number[][][])[0]
  }
  throw new Error(`Cannot extract polygon coords from geometry type: ${geometry.type}`)
}
