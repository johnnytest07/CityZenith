/**
 * The type of section in a local planning document.
 *
 * - chapter        : Top-level numbered chapter or named part
 * - policy         : A named planning policy (e.g. "Policy H1: Affordable Housing")
 * - appendix       : Appendix section
 * - supporting-text: Everything else — introductions, context paragraphs, justifications
 */
export type SectionType = 'chapter' | 'policy' | 'appendix' | 'supporting-text'

/** A single text chunk extracted from a local plan PDF, before embedding. */
export interface PlanChunk {
  chunkId:     string       // UUID
  source:      string       // original filename
  council:     string       // e.g. "Royal Greenwich"
  section:     string       // heading text under which this chunk falls
  sectionType: SectionType
  pageStart:   number       // page where this chunk begins
  chunkIndex:  number       // sequential index across the whole document
  text:        string       // the raw chunk text
  charCount:   number
}

/** A PlanChunk ready to be inserted into MongoDB, with its embedding vector. */
export interface PlanChunkDocument extends PlanChunk {
  /** 768-dimensional float array from Gemini text-embedding-004 */
  embedding: number[]
}

/** A search result returned by the vector query. */
export interface QueryResult {
  score:  number     // cosine similarity score (higher = more relevant)
  chunk:  PlanChunk
}
