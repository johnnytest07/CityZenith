import { getMongoCollection } from './store';
import { createEmbedding } from './embed';

export async function findSimilarDocuments(
  council: string,
  queryText: string,
  limit: number = 5
): Promise<any[]> {
  const collection = await getMongoCollection();
  const queryEmbedding = await createEmbedding(queryText);

  console.log(`Searching for documents in ${council} similar to: "${queryText}"`);

  // This is a placeholder for a real vector search query.
  // The actual query will depend on your MongoDB setup (e.g., Atlas Search).
  // This example simulates a search by finding documents for the correct council
  // and then sorting them by a simulated "similarity" score in-memory.
  
  const documents = await collection.find({ council }).toArray();

  if (documents.length === 0) {
    return [];
  }

  // Simulate similarity score (e.g., cosine similarity)
  const scoredDocuments = documents.map(doc => {
    // Fake a similarity score for the demo
    let score = 0;
    for (let i = 0; i < queryEmbedding.length; i++) {
      score += queryEmbedding[i] * doc.embedding[i];
    }
    return { ...doc, score };
  });

  // Sort by score descending
  scoredDocuments.sort((a, b) => b.score - a.score);

  console.log(`Found ${scoredDocuments.length} documents, returning top ${limit}.`);
  return scoredDocuments.slice(0, limit);
}
