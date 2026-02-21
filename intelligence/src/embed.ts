import OpenAI from 'openai';
import { Document } from './types';

const EMBED_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 100; // Safe + efficient
const PAUSE_MS = 300;   // Small pause between batches

export async function embedDocuments(
  documents: Omit<Document, 'embedding'>[]
): Promise<Document[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set.');
  }

  const client = new OpenAI({ apiKey });

  console.log(
    `OPENAI_API_KEY present (length: ${apiKey.length}). Embedding with ${EMBED_MODEL}...`
  );

  const embeddedDocuments: Document[] = [];

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    const inputs = batch.map((doc) => doc.text);

    console.log(
      `  Progress: ${Math.min(i + BATCH_SIZE, documents.length)}/${documents.length}...`
    );

    const response = await client.embeddings.create({
      model: EMBED_MODEL,
      input: inputs,
    });

    response.data.forEach((item, index) => {
      embeddedDocuments.push({
        ...batch[index],
        embedding: item.embedding,
      });
    });

    // Small pause between batches to stay friendly with rate limits
    if (i + BATCH_SIZE < documents.length) {
      await new Promise((r) => setTimeout(r, PAUSE_MS));
    }
  }

  console.log(
    `Finished embedding. Dimension: ${
      embeddedDocuments[0]?.embedding.length ?? 'n/a'
    }`
  );

  return embeddedDocuments;
}
