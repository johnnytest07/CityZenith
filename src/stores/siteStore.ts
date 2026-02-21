import { create } from 'zustand'
import type { SiteContext, SiteLoadingStates } from '@/types/siteContext'
import { emptyConstraints } from '@/types/constraints'

interface SiteStore {
  /** The assembled spatial evidence container. Null when no site is selected. */
  siteContext: SiteContext | null

  /** Per-source loading state for progressive UI updates */
  loadingStates: SiteLoadingStates

  error: string | null

  /**
   * Initialise a new SiteContext with siteId + siteGeometry.
   * Called at the start of site selection to open the panel immediately.
   */
  initialiseSiteContext: (siteId: string, siteGeometry: GeoJSON.Geometry) => void

  /**
   * Merge partial SiteContext fields as each data source resolves.
   * No computed values should ever be passed here — raw spatial evidence only.
   */
  updateSiteContext: (partial: Partial<SiteContext>) => void

  /** Clear everything — called when user closes the panel */
  clearSiteContext: () => void

  setLoading: (source: keyof SiteLoadingStates, loading: boolean) => void
  setError: (error: string | null) => void
}

const DEFAULT_LOADING: SiteLoadingStates = {
  precedent: false,
  stats: false,
  constraints: false,
  contextFeatures: false,
}

export const useSiteStore = create<SiteStore>((set) => ({
  siteContext: null,
  loadingStates: DEFAULT_LOADING,
  error: null,

  initialiseSiteContext: (siteId, siteGeometry) =>
    set({
      siteContext: {
        siteId,
        siteGeometry,
        planningPrecedentFeatures: { type: 'FeatureCollection', features: [] },
        planningContextStats: null,
        statutoryConstraints: emptyConstraints(),
        nearbyContextFeatures: {
          buildings: { type: 'FeatureCollection', features: [] },
          landuse: { type: 'FeatureCollection', features: [] },
          queryRadiusM: 250,
        },
      },
      error: null,
    }),

  updateSiteContext: (partial) =>
    set((state) => {
      if (!state.siteContext) return state
      return {
        siteContext: { ...state.siteContext, ...partial },
      }
    }),

  clearSiteContext: () =>
    set({
      siteContext: null,
      loadingStates: DEFAULT_LOADING,
      error: null,
    }),

  setLoading: (source, loading) =>
    set((state) => ({
      loadingStates: { ...state.loadingStates, [source]: loading },
    })),

  setError: (error) => set({ error }),
}))
