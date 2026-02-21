import { GeoJsonLayer } from '@deck.gl/layers'

/**
 * Renders the selected site boundary as a highlighted outline.
 */
export function createSiteHighlightLayer(siteGeometry: GeoJSON.Geometry) {
  const feature: GeoJSON.Feature = {
    type: 'Feature',
    geometry: siteGeometry,
    properties: {},
  }

  return new GeoJsonLayer({
    id: 'site-highlight',
    data: { type: 'FeatureCollection', features: [feature] },
    pickable: false,
    stroked: true,
    filled: true,
    extruded: false,
    parameters: { depthTest: false },

    getFillColor: [255, 255, 255, 25],
    getLineColor: [250, 204, 21, 255],    // yellow-400
    getLineWidth: 3,
    lineWidthMinPixels: 2,
    lineWidthMaxPixels: 5,
    lineWidthUnits: 'pixels',
  })
}
