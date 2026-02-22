import clientPromise from '@/lib/mongoClient'
import type { Collection } from 'mongodb'
import type { Document } from './types'

const COLLECTION_NAME = 'council_plan_chunks'

async function getCollection(): Promise<Collection<Document>> {
  const client = await clientPromise
  const db = client.db(process.env.MONGODB_DB || 'cityzenith')
  return db.collection<Document>(COLLECTION_NAME)
}

export async function uploadDocuments(documents: Document[]): Promise<void> {
  if (documents.length === 0) return
  const coll = await getCollection()
  const operations = documents.map((doc) => ({
    replaceOne: { filter: { id: doc.id }, replacement: doc, upsert: true },
  }))
  await coll.bulkWrite(operations)
}

export async function fetchDocumentsByCouncil(council: string): Promise<Document[]> {
  const coll = await getCollection()
  return coll.find({ council }).toArray()
}

export async function closeMongoClient(): Promise<void> {
  // Intentionally left blank — connection is managed by shared clientPromise in lib/mongoClient
}
