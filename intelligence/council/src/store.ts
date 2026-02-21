import { MongoClient, type Db, type Collection } from 'mongodb'
import type { PlanChunkDocument, PlanChunk, QueryResult } from './types.js'

// ─── Constants ─────────────────────────────────────────────────────────────

export const COLLECTION_NAME  = 'council_plan_chunks'
export const VECTOR_INDEX_NAME = 'vector_index'

/** Dimensions for Gemini text-embedding-004 */
const EMBEDDING_DIMS = 768

// ─── Connection ─────────────────────────────────────────────────────────────

let _client: MongoClient | null = null

export async function getDb(uri: string, dbName: string): Promise<Db> {
  if (!_client) {
    _client = new MongoClient(uri)
    await _client.connect()
  }
  return _client.db(dbName)
}

export async function closeDb(): Promise<void> {
  if (_client) {
    await _client.close()
    _client = null
  }
}

// ─── Index management ───────────────────────────────────────────────────────

/**
 * Ensure the vector search index exists on the collection.
 *
 * Works with MongoDB Atlas and MongoDB 7.0+ local deployments.
 * If the index already exists this is a no-op.
 *
 * After ingestion, MongoDB Atlas may take a few minutes to build the index.
 */
export async function ensureVectorIndex(
  collection: Collection<PlanChunkDocument>,
): Promise<void> {
  try {
    const existing = await collection.listSearchIndexes(VECTOR_INDEX_NAME).toArray()
    if (existing.length > 0) return  // already exists

    await collection.createSearchIndex({
      name: VECTOR_INDEX_NAME,
      type: 'vectorSearch',
      definition: {
        fields: [
          {
            type:          'vector',
            path:          'embedding',
            numDimensions: EMBEDDING_DIMS,
            similarity:    'cosine',
          },
          // Filter fields — allows pre-filtering results by council or sectionType
          { type: 'filter', path: 'council' },
          { type: 'filter', path: 'sectionType' },
        ],
      },
    })

    console.log(`  Vector search index "${VECTOR_INDEX_NAME}" created (Atlas will build it in the background).`)
  } catch (err) {
    // Atlas free tier may not support programmatic index creation — log and continue
    console.warn(
      `  Could not create vector index automatically: ${(err as Error).message}\n` +
      `  Create it manually in Atlas UI (see README for the index definition).`,
    )
  }
}

// ─── Ingestion ───────────────────────────────────────────────────────────────

/**
 * Insert (or replace) all chunks for a given source document.
 *
 * Drops all existing chunks for the same `source` filename first,
 * so re-running ingest on the same PDF is safe.
 */
export async function upsertChunks(
  db:     Db,
  chunks: PlanChunkDocument[],
): Promise<void> {
  if (chunks.length === 0) return

  const col = db.collection<PlanChunkDocument>(COLLECTION_NAME)
  const source = chunks[0].source

  // Remove stale data for this source
  await col.deleteMany({ source })

  // Insert fresh
  await col.insertMany(chunks)
}

// ─── Vector search ───────────────────────────────────────────────────────────

export interface SearchOptions {
  /** Max results to return (default 5) */
  limit?:       number
  /** Only return chunks from this council */
  council?:     string
  /** Only return chunks of this section type */
  sectionType?: string
  /**
   * numCandidates for the ANN search (default 10× limit).
   * Higher = slower but more accurate.
   */
  numCandidates?: number
}

/**
 * Semantic search over ingested plan chunks.
 *
 * Uses MongoDB $vectorSearch which requires an Atlas M10+ cluster
 * or a local MongoDB 7.0+ deployment with the vector search plugin.
 */
export async function searchChunks(
  db:          Db,
  queryVector: number[],
  options:     SearchOptions = {},
): Promise<QueryResult[]> {
  const limit         = options.limit         ?? 5
  const numCandidates = options.numCandidates ?? limit * 10

  const vectorStage: Record<string, unknown> = {
    $vectorSearch: {
      index:         VECTOR_INDEX_NAME,
      path:          'embedding',
      queryVector,
      numCandidates,
      limit,
    },
  }

  // Optional pre-filters
  if (options.council || options.sectionType) {
    const filter: Record<string, string> = {}
    if (options.council)     filter['council']     = options.council
    if (options.sectionType) filter['sectionType'] = options.sectionType
    vectorStage['$vectorSearch'] = { ...(vectorStage['$vectorSearch'] as object), filter }
  }

  const col = db.collection<PlanChunkDocument>(COLLECTION_NAME)

  const docs = await col
    .aggregate([
      vectorStage,
      {
        $project: {
          _id:         0,
          embedding:   0,   // exclude the large vector from results
          score:       { $meta: 'vectorSearchScore' },
          chunkId:     1,
          source:      1,
          council:     1,
          section:     1,
          sectionType: 1,
          pageStart:   1,
          chunkIndex:  1,
          text:        1,
          charCount:   1,
        },
      },
    ])
    .toArray()

  return docs.map((d) => ({
    score: d['score'] as number,
    chunk: d as unknown as PlanChunk,
  }))
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export async function getCollectionStats(db: Db): Promise<{
  total: number
  byCouncil: Array<{ council: string; count: number }>
  bySectionType: Array<{ sectionType: string; count: number }>
}> {
  const col = db.collection<PlanChunkDocument>(COLLECTION_NAME)
  const [total, byCouncil, bySectionType] = await Promise.all([
    col.countDocuments(),
    col.aggregate<{ council: string; count: number }>([
      { $group: { _id: '$council', count: { $sum: 1 } } },
      { $project: { _id: 0, council: '$_id', count: 1 } },
    ]).toArray(),
    col.aggregate<{ sectionType: string; count: number }>([
      { $group: { _id: '$sectionType', count: { $sum: 1 } } },
      { $project: { _id: 0, sectionType: '$_id', count: 1 } },
      { $sort: { count: -1 } },
    ]).toArray(),
  ])
  return { total, byCouncil, bySectionType }
}
