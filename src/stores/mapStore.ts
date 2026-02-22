import { create } from 'zustand'
import type { ViewState } from '@/types/map'
import { DEFAULT_VIEW_STATE } from '@/types/map'

interface MapStore {
  viewState: ViewState
  /** WGS84 bounding box [west, south, east, north] */
  bounds: [number, number, number, number] | null

  /**
   * The building feature that was clicked — stored with its full properties
   * (render_height, height, etc.) so MapCanvas can render a 3D extrusion highlight.
   * Null when the user clicked open land (circle fallback).
   */
  selectedBuilding: GeoJSON.Feature | null

  /** Whether the residential market value hex layer is visible */
  marketValueEnabled: boolean
  /** True while the market value fetch is in-flight */
  marketValueLoading: boolean

  setViewState: (vs: Partial<ViewState>) => void
  setBounds: (bounds: [number, number, number, number]) => void
  setSelectedBuilding: (feature: GeoJSON.Feature | null) => void
  setMarketValueEnabled: (v: boolean) => void
  setMarketValueLoading: (v: boolean) => void
}

export const useMapStore = create<MapStore>((set) => ({
  viewState: DEFAULT_VIEW_STATE,
  bounds: null,
  selectedBuilding: null,
  marketValueEnabled: false,
  marketValueLoading: false,

  setViewState: (vs) =>
    set((state) => ({
      viewState: { ...state.viewState, ...vs },
    })),

  setBounds: (bounds) => set({ bounds }),
  setSelectedBuilding: (feature) => set({ selectedBuilding: feature }),
  setMarketValueEnabled: (v) => set({ marketValueEnabled: v }),
  setMarketValueLoading: (v) => set({ marketValueLoading: v }),
}))
