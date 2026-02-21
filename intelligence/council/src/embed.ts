/**
 * Batch embedding using the Gemini text-embedding-004 REST API.
 *
 * No SDK required — uses fetch directly, same pattern as the main app's API routes.
 * Model produces 768-dimensional float vectors.
 */

const GEMINI_BASE  = 'https://generativelanguage.googleapis.com/v1beta'
const EMBED_MODEL  = 'text-embedding-004'

/** Max texts per batchEmbedContents call (Gemini limit = 100) */
const BATCH_SIZE = 50

/** Delay between batches in ms — prevents hitting the free-tier rate limit */
const BATCH_DELAY_MS = 1100

type TaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'

interface EmbedRequest {
  model:    string
  content:  { parts: Array<{ text: string }> }
  taskType: TaskType
}

interface BatchEmbedResponse {
  embeddings: Array<{ values: number[] }>
}

async function batchEmbed(
  texts:   string[],
  apiKey:  string,
  task:    TaskType,
  logPrefix?: string,
): Promise<number[][]> {
  const requests: EmbedRequest[] = texts.map((text) => ({
    model:    `models/${EMBED_MODEL}`,
    content:  { parts: [{ text }] },
    taskType: task,
  }))

  const res = await fetch(
    `${GEMINI_BASE}/models/${EMBED_MODEL}:batchEmbedContents?key=${apiKey}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ requests }),
    },
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Gemini batchEmbedContents failed (${res.status}): ${JSON.stringify(err)}`)
  }

  const data = (await res.json()) as BatchEmbedResponse
  if (data.embeddings.length !== texts.length) {
    throw new Error(
      `Embedding count mismatch: sent ${texts.length}, got ${data.embeddings.length}`,
    )
  }

  if (logPrefix) {
    process.stdout.write(`${logPrefix}\r`)
  }

  return data.embeddings.map((e) => e.values)
}

/**
 * Embed an array of texts for document ingestion (RETRIEVAL_DOCUMENT task).
 * Handles batching and rate-limit delays automatically.
 *
 * @param texts   - The strings to embed (one per chunk)
 * @param apiKey  - Gemini API key
 * @param verbose - Log progress to stdout
 */
export async function embedDocuments(
  texts:   string[],
  apiKey:  string,
  verbose = false,
): Promise<number[][]> {
  const all: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(texts.length / BATCH_SIZE)

    const label = verbose
      ? `  Embedding batch ${batchNum}/${totalBatches} (${i + 1}–${Math.min(i + BATCH_SIZE, texts.length)} of ${texts.length})...`
      : undefined

    const vectors = await batchEmbed(batch, apiKey, 'RETRIEVAL_DOCUMENT', label)
    all.push(...vectors)

    // Rate-limit delay between batches (skip after last batch)
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
    }
  }

  if (verbose) process.stdout.write('\n')

  return all
}

/**
 * Embed a single query string for retrieval (RETRIEVAL_QUERY task).
 * Use RETRIEVAL_QUERY (not RETRIEVAL_DOCUMENT) for search-time queries.
 */
export async function embedQuery(text: string, apiKey: string): Promise<number[]> {
  const [vector] = await batchEmbed([text], apiKey, 'RETRIEVAL_QUERY')
  return vector
}
