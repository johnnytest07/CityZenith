import { MongoClient, Collection } from 'mongodb'
import type { Document } from './types'

const COLLECTION_NAME = 'council_plan_chunks'

let client: MongoClient
let collection: Collection<Document>

export async function getMongoCollection(): Promise<Collection<Document>> {
  if (collection) return collection

  const MONGODB_URI = process.env.MONGODB_URI
  const DB_NAME = process.env.MONGODB_DB || 'cityzenith'

  if (!MONGODB_URI) throw new Error('MONGODB_URI environment variable is not set.')

  try {
    client = new MongoClient(MONGODB_URI)
    await client.connect()
    const db = client.db(DB_NAME)
    collection = db.collection<Document>(COLLECTION_NAME)
    return collection
  } catch (error) {
    console.error('Failed to connect to MongoDB', error)
    throw error
  }
}

export async function uploadDocuments(documents: Document[]): Promise<void> {
  if (documents.length === 0) return
  const coll = await getMongoCollection()
  const operations = documents.map((doc) => ({
    replaceOne: { filter: { id: doc.id }, replacement: doc, upsert: true },
  }))
  await coll.bulkWrite(operations)
}

export async function closeMongoClient(): Promise<void> {
  if (client) await client.close()
}

export async function fetchDocumentsByCouncil(council: string): Promise<Document[]> {
  const coll = await getMongoCollection()
  return coll.find({ council }).toArray()
}
