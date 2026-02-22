import { create } from 'zustand'
import type { AnalysisStage, CouncilSuggestion } from '@/types/council'

const INITIAL_STAGES: AnalysisStage[] = [
  { stageNum: 1,  name: 'Land use & vacancy audit',              description: 'Identifying underutilised and vacant parcels across the region.',                                    status: 'pending', suggestionCount: 0 },
  { stageNum: 2,  name: 'Statutory constraint mapping',          description: 'Mapping constraint-burdened zones and assessing proportionality to planning need.',                  status: 'pending', suggestionCount: 0 },
  { stageNum: 3,  name: 'Planning performance analysis',         description: 'Detecting refusal clusters, stalled schemes, and systemic delivery blockages.',                      status: 'pending', suggestionCount: 0 },
  { stageNum: 4,  name: 'Local plan opportunity areas',          description: 'Extracting regeneration allocations and strategic sites from the adopted Local Plan.',                status: 'pending', suggestionCount: 0 },
  { stageNum: 5,  name: 'Housing delivery & pipeline',           description: 'Comparing approved pipeline to housing targets and identifying acute under-delivery zones.',         status: 'pending', suggestionCount: 0 },
  { stageNum: 6,  name: 'Green & blue infrastructure deficit',   description: 'Measuring open space and green infrastructure provision against Fields in Trust standards.',         status: 'pending', suggestionCount: 0 },
  { stageNum: 7,  name: 'Transport & connectivity gaps',         description: 'Pinpointing low PTAL zones, missing active travel links, and disconnected communities.',            status: 'pending', suggestionCount: 0 },
  { stageNum: 8,  name: 'Economic & employment challenges',      description: 'Identifying employment land loss, vacant commercial premises, and business district decline.',       status: 'pending', suggestionCount: 0 },
  { stageNum: 9,  name: 'Opportunity zone synthesis',           description: 'Cross-referencing all evidence layers to rank highest-priority opportunity zones.',                  status: 'pending', suggestionCount: 0 },
  { stageNum: 10, name: 'Implementation & delivery proposals',  description: 'Producing concrete spatial interventions per opportunity zone with delivery mechanisms.',            status: 'pending', suggestionCount: 0 },
]

interface CouncilStore {
  stages: AnalysisStage[]
  suggestions: CouncilSuggestion[]
  isAnalysing: boolean
  currentStageNum: number | null
  selectedSuggestionId: string | null
  hoveredSuggestionId: string | null
  error: string | null
  fromCache: boolean
  cachedAt: string | null

  startAnalysis: () => void
  setCacheHit: (cachedAt: string) => void
  receiveStageStart: (stageNum: number, fromCache?: boolean) => void
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
  fromCache: false,
  cachedAt: null,

  startAnalysis: () =>
    set({
      stages: INITIAL_STAGES.map((s) => ({ ...s })),
      suggestions: [],
      isAnalysing: true,
      currentStageNum: null,
      error: null,
      selectedSuggestionId: null,
      fromCache: false,
      cachedAt: null,
    }),

  setCacheHit: (cachedAt) => set({ fromCache: true, cachedAt }),

  receiveStageStart: (stageNum, fromCache) =>
    set((state) => ({
      currentStageNum: stageNum,
      stages: state.stages.map((s) =>
        s.stageNum === stageNum ? { ...s, status: 'running', fromCache } : s,
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
