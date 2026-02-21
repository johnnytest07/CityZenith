import { create } from 'zustand'
import type { AnalysisStage, CouncilSuggestion } from '@/types/council'

const INITIAL_STAGES: AnalysisStage[] = [
  { stageNum: 1,  name: 'Mapping land use and vacancy patterns',            description: 'Identifying underutilised and vacant parcels across the region.', status: 'pending', suggestionCount: 0 },
  { stageNum: 2,  name: 'Identifying constraint-burdened low-delivery zones', description: 'Locating areas with overlapping statutory constraints limiting development.', status: 'pending', suggestionCount: 0 },
  { stageNum: 3,  name: 'Analysing planning refusal clusters and stalled sites', description: 'Detecting patterns in refused applications and sites with repeated failures.', status: 'pending', suggestionCount: 0 },
  { stageNum: 4,  name: 'Querying local plan regeneration policies',         description: 'Extracting opportunity area and regeneration zone designations from the adopted plan.', status: 'pending', suggestionCount: 0 },
  { stageNum: 5,  name: 'Assessing residential delivery gap vs housing targets', description: 'Comparing approved pipeline to the 5-year housing land supply target.', status: 'pending', suggestionCount: 0 },
  { stageNum: 6,  name: 'Evaluating green infrastructure and open space deficit', description: 'Measuring open space provision against national and local accessibility standards.', status: 'pending', suggestionCount: 0 },
  { stageNum: 7,  name: 'Identifying transport and connectivity gaps',        description: 'Pinpointing areas with poor public transport access and missing active travel links.', status: 'pending', suggestionCount: 0 },
  { stageNum: 8,  name: 'Synthesising and ranking opportunity zones',         description: 'Cross-referencing all evidence layers to score and prioritise opportunity zones.', status: 'pending', suggestionCount: 0 },
  { stageNum: 9,  name: 'Generating implementation proposals per zone',       description: 'Producing concrete spatial interventions for each ranked opportunity.', status: 'pending', suggestionCount: 0 },
  { stageNum: 10, name: 'Producing policy-backed executive summary',          description: 'Synthesising findings into an officer-ready summary with Local Plan citations.', status: 'pending', suggestionCount: 0 },
]

interface CouncilStore {
  stages: AnalysisStage[]
  suggestions: CouncilSuggestion[]
  isAnalysing: boolean
  currentStageNum: number | null
  selectedSuggestionId: string | null
  hoveredSuggestionId: string | null
  error: string | null

  startAnalysis: () => void
  receiveStageStart: (stageNum: number) => void
  receiveSuggestion: (suggestion: CouncilSuggestion) => void
  receiveStageComplete: (stageNum: number, suggestionCount: number) => void
  finishAnalysis: () => void
  setSelectedSuggestion: (id: string | null) => void
  setHoveredSuggestion: (id: string | null) => void
  clearAnalysis: () => void
  setError: (error: string | null) => void
}

export const useCouncilStore = create<CouncilStore>((set) => ({
  stages: INITIAL_STAGES.map((s) => ({ ...s })),
  suggestions: [],
  isAnalysing: false,
  currentStageNum: null,
  selectedSuggestionId: null,
  hoveredSuggestionId: null,
  error: null,

  startAnalysis: () =>
    set({
      stages: INITIAL_STAGES.map((s) => ({ ...s })),
      suggestions: [],
      isAnalysing: true,
      currentStageNum: null,
      error: null,
      selectedSuggestionId: null,
    }),

  receiveStageStart: (stageNum) =>
    set((state) => ({
      currentStageNum: stageNum,
      stages: state.stages.map((s) =>
        s.stageNum === stageNum ? { ...s, status: 'running' } : s,
      ),
    })),

  receiveSuggestion: (suggestion) =>
    set((state) => ({
      suggestions: [...state.suggestions, suggestion],
    })),

  receiveStageComplete: (stageNum, suggestionCount) =>
    set((state) => ({
      stages: state.stages.map((s) =>
        s.stageNum === stageNum
          ? { ...s, status: 'complete', suggestionCount }
          : s,
      ),
    })),

  finishAnalysis: () =>
    set({ isAnalysing: false, currentStageNum: null }),

  setSelectedSuggestion: (id) => set({ selectedSuggestionId: id }),

  setHoveredSuggestion: (id) => set({ hoveredSuggestionId: id }),

  clearAnalysis: () =>
    set({
      stages: INITIAL_STAGES.map((s) => ({ ...s })),
      suggestions: [],
      isAnalysing: false,
      currentStageNum: null,
      selectedSuggestionId: null,
      hoveredSuggestionId: null,
      error: null,
    }),

  setError: (error) => set({ error, isAnalysing: false }),
}))
