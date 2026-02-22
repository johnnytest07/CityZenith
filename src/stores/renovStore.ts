import { create } from 'zustand'
import type { RenovStep, RenovationBuilding, RenovationResult } from '@/types/renovation'

interface RenovStore {
  renovMode: boolean
  renovStep: RenovStep
  selectedBuilding: RenovationBuilding | null
  renovResult: RenovationResult | null
  renovError: string | null

  activateRenovMode: () => void
  deactivateRenovMode: () => void
  setRenovStep: (step: RenovStep) => void
  setSelectedBuilding: (b: RenovationBuilding | null) => void
  setRenovResult: (r: RenovationResult) => void
  setRenovError: (e: string | null) => void
}

export const useRenovStore = create<RenovStore>((set) => ({
  renovMode: false,
  renovStep: 'idle',
  selectedBuilding: null,
  renovResult: null,
  renovError: null,

  activateRenovMode: () =>
    set({
      renovMode: true,
      renovStep: 'idle',
      selectedBuilding: null,
      renovResult: null,
      renovError: null,
    }),

  deactivateRenovMode: () =>
    set({
      renovMode: false,
      renovStep: 'idle',
      selectedBuilding: null,
      renovResult: null,
      renovError: null,
    }),

  setRenovStep: (step) => set({ renovStep: step }),

  setSelectedBuilding: (b) => set({ selectedBuilding: b }),

  setRenovResult: (r) => set({ renovResult: r, renovStep: 'result' }),

  setRenovError: (e) => set({ renovError: e, renovStep: 'error' }),
}))
