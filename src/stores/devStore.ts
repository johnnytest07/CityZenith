import { create } from 'zustand'
import type { BuildStep, BuildRecommendation } from '@/types/devMode'

interface DevStore {
  buildMode: 'off' | 'new'
  buildStep: BuildStep
  /** In-progress polygon nodes while drawing */
  polygonNodes: [number, number][]
  /** Live cursor position for ghost preview line */
  cursorPosition: [number, number] | null
  /** Completed closed ring after finishPolygon */
  buildPolygon: [number, number][] | null
  /** Actual drawn area in m² */
  buildFootprintM2: number | null
  buildRecommendation: BuildRecommendation | null
  roadWarning: boolean
  buildError: string | null
  hoverInfo: { x: number; y: number } | null
  /** Set by DevModePanel "Complete shape" button; consumed by MapCanvas useEffect */
  pendingComplete: boolean

  activateBuildNew: () => void
  deactivateBuild: () => void
  setBuildStep: (s: BuildStep) => void
  addPolygonNode: (node: [number, number]) => void
  completePolygon: (polygon: [number, number][], footprintM2: number) => void
  setCursorPosition: (pos: [number, number] | null) => void
  /** Clear polygon nodes and go back to 'place' step */
  resetToPlace: () => void
  requestComplete: () => void
  clearPendingComplete: () => void
  setRecommendation: (rec: BuildRecommendation) => void
  switchAlternative: (index: number) => void
  setRoadWarning: (v: boolean) => void
  setBuildError: (e: string | null) => void
  setHoverInfo: (info: { x: number; y: number } | null) => void
  clearBuild: () => void
}

export const useDevStore = create<DevStore>((set) => ({
  buildMode: 'off',
  buildStep: 'idle',
  polygonNodes: [],
  cursorPosition: null,
  buildPolygon: null,
  buildFootprintM2: null,
  buildRecommendation: null,
  roadWarning: false,
  buildError: null,
  hoverInfo: null,
  pendingComplete: false,

  activateBuildNew: () =>
    set({
      buildMode: 'new',
      buildStep: 'place',
      polygonNodes: [],
      cursorPosition: null,
      buildPolygon: null,
      buildFootprintM2: null,
      buildRecommendation: null,
      roadWarning: false,
      buildError: null,
      hoverInfo: null,
      pendingComplete: false,
    }),

  deactivateBuild: () =>
    set({
      buildMode: 'off',
      buildStep: 'idle',
      polygonNodes: [],
      cursorPosition: null,
      buildPolygon: null,
      buildFootprintM2: null,
      buildRecommendation: null,
      roadWarning: false,
      buildError: null,
      hoverInfo: null,
      pendingComplete: false,
    }),

  setBuildStep: (s) => set({ buildStep: s }),

  addPolygonNode: (node) =>
    set((state) => ({ polygonNodes: [...state.polygonNodes, node] })),

  completePolygon: (polygon, footprintM2) =>
    set({
      buildPolygon: polygon,
      buildFootprintM2: footprintM2,
      polygonNodes: [],
      cursorPosition: null,
    }),

  setCursorPosition: (pos) => set({ cursorPosition: pos }),

  resetToPlace: () =>
    set({
      buildStep: 'place',
      polygonNodes: [],
      cursorPosition: null,
      buildPolygon: null,
      buildFootprintM2: null,
      buildRecommendation: null,
      roadWarning: false,
      buildError: null,
    }),

  requestComplete: () => set({ pendingComplete: true }),
  clearPendingComplete: () => set({ pendingComplete: false }),

  setRecommendation: (rec) =>
    set({ buildRecommendation: { ...rec, activeIndex: 0 } }),

  switchAlternative: (index) =>
    set((state) => {
      if (!state.buildRecommendation) return state
      return { buildRecommendation: { ...state.buildRecommendation, activeIndex: index } }
    }),

  setRoadWarning: (v) => set({ roadWarning: v }),
  setBuildError: (e) => set({ buildError: e }),
  setHoverInfo: (info) => set({ hoverInfo: info }),

  clearBuild: () =>
    set({
      buildMode: 'off',
      buildStep: 'idle',
      polygonNodes: [],
      cursorPosition: null,
      buildPolygon: null,
      buildFootprintM2: null,
      buildRecommendation: null,
      roadWarning: false,
      buildError: null,
      hoverInfo: null,
      pendingComplete: false,
    }),
}))
