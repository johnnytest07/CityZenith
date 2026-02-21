import { parseCouncilData } from './parse'
import { embedDocuments } from './embed'
import { uploadDocuments, closeMongoClient } from './store'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const envPath = path.resolve(process.cwd(), '.env.local')
dotenv.config({ path: envPath })

export async function runIngestionPipeline(): Promise<void> {
  const parsedDocs = await parseCouncilData()
  const embeddedDocs = await embedDocuments(parsedDocs)
  await uploadDocuments(embeddedDocs)
  await closeMongoClient()
}

// ESM-safe main guard
if (typeof process !== 'undefined' && process.argv[1] === fileURLToPath(import.meta.url)) {
  ;(async () => {
    try {
      await runIngestionPipeline()
    } catch (err) {
      console.error('Ingestion pipeline failed:', err)
      process.exit(1)
    }
  })()
}
