import { create } from 'zustand'
import type { BuildStep, BuildRecommendation } from '@/types/devMode'

interface DevStore {
  buildMode: 'off' | 'new'
  buildStep: BuildStep
  buildLocation: [number, number] | null
  buildRecommendation: BuildRecommendation | null
  roadWarning: boolean
  buildError: string | null
  hoverInfo: { x: number; y: number } | null

  activateBuildNew: () => void
  deactivateBuild: () => void
  setBuildStep: (s: BuildStep) => void
  setBuildLocation: (loc: [number, number]) => void
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
  buildLocation: null,
  buildRecommendation: null,
  roadWarning: false,
  buildError: null,
  hoverInfo: null,

  activateBuildNew: () => set({ buildMode: 'new', buildStep: 'place', buildError: null, buildLocation: null, buildRecommendation: null, roadWarning: false }),
  deactivateBuild: () => set({ buildMode: 'off', buildStep: 'idle', buildLocation: null, buildRecommendation: null, roadWarning: false, buildError: null, hoverInfo: null }),

  setBuildStep: (s) => set({ buildStep: s }),
  setBuildLocation: (loc) => set({ buildLocation: loc }),
  setRecommendation: (rec) => set({ buildRecommendation: { ...rec, activeIndex: 0 } }),
  switchAlternative: (index) =>
    set((state) => {
      if (!state.buildRecommendation) return state
      return { buildRecommendation: { ...state.buildRecommendation, activeIndex: index } }
    }),
  setRoadWarning: (v) => set({ roadWarning: v }),
  setBuildError: (e) => set({ buildError: e }),
  setHoverInfo: (info) => set({ hoverInfo: info }),
  clearBuild: () => set({ buildMode: 'off', buildStep: 'idle', buildLocation: null, buildRecommendation: null, roadWarning: false, buildError: null, hoverInfo: null }),
}))
