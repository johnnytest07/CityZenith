import { create } from 'zustand'
import type { Document } from '@/intelligence/types'

interface IntelligenceStore {
  documents: Document[]
  loading: boolean
  error: string | null
  setDocuments: (documents: Document[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clear: () => void
}

export const useIntelligenceStore = create<IntelligenceStore>((set) => ({
  documents: [],
  loading: false,
  error: null,
  setDocuments: (documents) => set({ documents, loading: false, error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  clear: () => set({ documents: [], loading: false, error: null }),
}))
