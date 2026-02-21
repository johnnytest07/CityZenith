export interface ViewState {
  longitude: number
  latitude: number
  zoom: number
  pitch: number
  bearing: number
}

export interface BoundingBox27700 {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface MapClickEvent {
  lngLat: [number, number]
  /** deck.gl picked object info, if any */
  pickedFeature?: GeoJSON.Feature | null
  /** MapLibre rendered features at click point */
  renderedFeatures?: maplibregl.MapGeoJSONFeature[]
}

// Thamesmead — default initial viewport
export const DEFAULT_VIEW_STATE: ViewState = {
  longitude: 0.1155,
  latitude: 51.501,
  zoom: 14,
  pitch: 45,
  bearing: -17.6,
}
