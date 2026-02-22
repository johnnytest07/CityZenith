/**
 * Semantic search over ingested local plan chunks stored in MongoDB Atlas.
 *
 * Uses OpenAI text-embedding-3-small (1536-dim) — the same model used during ingestion,
 * so query vectors are compatible with the stored document vectors.
 */

import OpenAI from 'openai'

const EMBED_MODEL       = 'text-embedding-3-small'
const MONGO_DB          = process.env.MONGODB_DB ?? 'cityzenith'
const PLAN_COLLECTION   = 'council_plan_chunks'
const VECTOR_INDEX_NAME = 'vector_index'

export interface PlanChunkResult {
  section:     string
  sectionType: string
  text:        string
  pageStart:   number
  score:       number
}

/** Embed a single query string using OpenAI text-embedding-3-small. */
async function embedQuery(text: string, apiKey: string): Promise<number[]> {
  const client = new OpenAI({ apiKey })
  const res = await client.embeddings.create({ model: EMBED_MODEL, input: text })
  return res.data[0].embedding
}

/**
 * Retrieve the most relevant local plan chunks for a given query.
 *
 * @param planCorpus  - The `council` field value in MongoDB (e.g. 'Royal Borough Greenwich')
 * @param queryText   - The semantic query (typically the stage focus text)
 * @param limit       - Number of chunks to return (default 6)
 *
 * Returns [] if MONGODB_URI / OPENAI_API_KEY are not set, or the collection is empty.
 */
export async function queryLocalPlan(
  planCorpus: string,
  queryText:  string,
  limit = 6,
): Promise<PlanChunkResult[]> {
  if (!process.env.MONGODB_URI) return []

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return []

  try {
    const clientPromise = (await import('@/lib/mongoClient')).default
    const client = await clientPromise
    const db = client.db(MONGO_DB)

    const t0 = Date.now()
    const queryVector = await embedQuery(queryText, apiKey)
    console.log(`[queryLocalPlan] embedding took ${Date.now() - t0}ms, corpus=${planCorpus}`)

    const t1 = Date.now()
    const docs = await db.collection(PLAN_COLLECTION).aggregate([
      {
        $vectorSearch: {
          index:         VECTOR_INDEX_NAME,
          path:          'embedding',
          queryVector,
          numCandidates: limit * 10,
          limit,
          filter:        { council: planCorpus },
        },
      },
      {
        $project: {
          _id: 0, embedding: 0,
          section: 1, sectionType: 1, text: 1, pageStart: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ]).toArray()
    console.log(`[queryLocalPlan] vectorSearch returned ${docs.length} docs in ${Date.now() - t1}ms`)

    return docs as PlanChunkResult[]
  } catch (err) {
    console.warn('[queryLocalPlan] error:', err)
    return []
  }
}
