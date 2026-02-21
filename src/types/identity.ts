export type UserRole = 'council' | 'developer'

export interface Council {
  id: string
  name: string
  /**
   * The 'council' field value in the MongoDB plan corpus.
   * Null means no local plan has been ingested for this council yet.
   */
  planCorpus: string | null
  /**
   * ONS LAD24CD code used to match this council against the boundary dataset.
   * Required for the council-mode map blur effect.
   */
  onsCode?: string
}

/**
 * Councils with an ingested local plan in the MongoDB corpus.
 * Extend this list as additional plans are added via:
 *   cd intelligence/council && npm run ingest [path/to/plan.pdf] [council name]
 */
export const SUPPORTED_COUNCILS: Council[] = [
  {
    id: 'royal-greenwich',
    name: 'Royal Greenwich',
    planCorpus: 'Royal Greenwich',
    onsCode: 'E09000011',
  },
  {
    id: 'other',
    name: 'Other council',
    planCorpus: null,
  },
]
