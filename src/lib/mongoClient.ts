import { MongoClient } from 'mongodb'

/**
 * Singleton MongoDB client for Next.js API routes.
 *
 * In development, the client is cached on `global` to survive HMR reloads.
 * In production, a single promise is created at module initialisation.
 *
 * Usage:
 *   const client = await clientPromise
 *   const db = client.db(process.env.MONGODB_DB ?? 'cityzenith')
 */

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

function createClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI
  if (!uri) return Promise.reject(new Error('MONGODB_URI is not configured'))
  const client = new MongoClient(uri)
  return client.connect()
}

const clientPromise: Promise<MongoClient> =
  process.env.NODE_ENV === 'development'
    ? (global._mongoClientPromise ??= createClientPromise())
    : createClientPromise()

export default clientPromise
