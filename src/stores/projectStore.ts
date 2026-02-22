import { create } from 'zustand'
import type { ProjectStep, ProjectType, ProjectBuilding, ProjectResult } from '@/types/project'

interface ProjectStore {
  projectMode: boolean
  projectStep: ProjectStep
  projectType: ProjectType | null
  selectedBuilding: ProjectBuilding | null
  projectResult: ProjectResult | null
  projectError: string | null

  activateProjectMode: () => void
  deactivateProjectMode: () => void
  /** Select a type — moves step to awaiting-click, clears previous result */
  setProjectType: (type: ProjectType) => void
  setProjectStep: (step: ProjectStep) => void
  setSelectedBuilding: (b: ProjectBuilding | null) => void
  setProjectResult: (r: ProjectResult) => void
  setProjectError: (e: string | null) => void
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projectMode: false,
  projectStep: 'idle',
  projectType: null,
  selectedBuilding: null,
  projectResult: null,
  projectError: null,

  activateProjectMode: () =>
    set({
      projectMode: true,
      projectStep: 'select-type',
      projectType: null,
      selectedBuilding: null,
      projectResult: null,
      projectError: null,
    }),

  deactivateProjectMode: () =>
    set({
      projectMode: false,
      projectStep: 'idle',
      projectType: null,
      selectedBuilding: null,
      projectResult: null,
      projectError: null,
    }),

  setProjectType: (type) =>
    set({
      projectType: type,
      projectStep: 'awaiting-click',
      selectedBuilding: null,
      projectResult: null,
      projectError: null,
    }),

  setProjectStep: (step) => set({ projectStep: step }),
  setSelectedBuilding: (b) => set({ selectedBuilding: b }),
  setProjectResult: (r) => set({ projectResult: r, projectStep: 'result' }),
  setProjectError: (e) => set({ projectError: e, projectStep: 'error' }),
}))
