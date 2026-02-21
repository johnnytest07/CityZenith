import { MongoClient, Collection } from 'mongodb';
import { Document } from './types';

const COLLECTION_NAME = 'council_plan_chunks';

let client: MongoClient;
let collection: Collection<Document>;

export async function getMongoCollection(): Promise<Collection<Document>> {
  if (collection) {
    return collection;
  }

  const MONGODB_URI = process.env.MONGODB_URI;
  const DB_NAME = process.env.MONGODB_DB || 'cityzenith';

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set.');
  }

  try {
    console.log('Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    collection = db.collection<Document>(COLLECTION_NAME);
    console.log('Successfully connected to MongoDB and got collection.');
    return collection;
  } catch (error) {
    console.error('Failed to connect to MongoDB', error);
    throw error;
  }
}

export async function uploadDocuments(documents: Document[]): Promise<void> {
  if (documents.length === 0) {
    console.log('No documents to upload.');
    return;
  }
  
  const coll = await getMongoCollection();
  console.log(`Uploading ${documents.length} documents to MongoDB...`);
  
  // Use a bulk write operation for efficiency
  const operations = documents.map(doc => ({
    replaceOne: {
      filter: { id: doc.id },
      replacement: doc,
      upsert: true,
    },
  }));

  const result = await coll.bulkWrite(operations);
  console.log(`MongoDB bulk write result: ${result.upsertedCount} upserted, ${result.modifiedCount} modified.`);
}

export async function closeMongoClient(): Promise<void> {
  if (client) {
    await client.close();
  }
}

export async function fetchDocumentsByCouncil(council: string): Promise<Document[]> {
    const coll = await getMongoCollection();
    console.log(`Fetching documents for council: ${council}`);
    const documents = await coll.find({ council }).toArray();
    console.log(`Found ${documents.length} documents for ${council}.`);
    return documents;
}
