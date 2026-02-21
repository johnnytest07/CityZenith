import OpenAI from 'openai'
import type { Document } from './types'

const EMBED_MODEL = 'text-embedding-3-small'
const BATCH_SIZE = 100
const PAUSE_MS = 300

export async function embedDocuments(documents: Omit<Document, 'embedding'>[]): Promise<Document[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is not set.')
  const client = new OpenAI({ apiKey })

  const embeddedDocuments: Document[] = []
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE)
    const inputs = batch.map((d) => d.text)
    const response = await client.embeddings.create({ model: EMBED_MODEL, input: inputs })
    response.data.forEach((item: any, index: number) => {
      embeddedDocuments.push({ ...batch[index], embedding: item.embedding })
    })
    if (i + BATCH_SIZE < documents.length) await new Promise((r) => setTimeout(r, PAUSE_MS))
  }
  return embeddedDocuments
}

export async function createEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is not set.')
  const client = new OpenAI({ apiKey })
  const res = await client.embeddings.create({ model: EMBED_MODEL, input: text })
  return res.data[0].embedding as number[]
}
