import { create } from 'zustand'
import type { ViewState } from '@/types/map'
import { DEFAULT_VIEW_STATE } from '@/types/map'

interface MapStore {
  viewState: ViewState
  /** WGS84 bounding box [west, south, east, north] */
  bounds: [number, number, number, number] | null

  setViewState: (vs: Partial<ViewState>) => void
  setBounds: (bounds: [number, number, number, number]) => void
}

export const useMapStore = create<MapStore>((set) => ({
  viewState: DEFAULT_VIEW_STATE,
  bounds: null,

  setViewState: (vs) =>
    set((state) => ({
      viewState: { ...state.viewState, ...vs },
    })),

  setBounds: (bounds) => set({ bounds }),
}))
