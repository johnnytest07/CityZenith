import { fetchDocumentsByCouncil } from './store'
import { createEmbedding } from './embed'

export async function findSimilarDocuments(council: string, queryText: string, limit = 5): Promise<any[]> {
  const queryEmbedding = await createEmbedding(queryText)
  const documents = await fetchDocumentsByCouncil(council)
  if (documents.length === 0) return []
  const scored = documents.map((doc) => {
    let score = 0
    for (let i = 0; i < Math.min(queryEmbedding.length, doc.embedding.length); i++) {
      score += queryEmbedding[i] * doc.embedding[i]
    }
    return { ...doc, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}
