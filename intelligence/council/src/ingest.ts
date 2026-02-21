/**
 * Ingest a local plan PDF into MongoDB.
 *
 * Usage:
 *   npm run ingest [path/to/plan.pdf] [council name]
 *
 * Defaults to the Royal Greenwich plan in the repo root when no path is given.
 *
 * Environment (loaded from ../../.env.local, then ./env):
 *   GEMINI_API_KEY  — Google Gemini API key
 *   MONGODB_URI     — MongoDB Atlas (or local) connection string
 *   MONGODB_DB      — Database name (default: cityzenith)
 */

import 'dotenv/config'
import { config } from 'dotenv'
import { resolve, join } from 'node:path'
import { existsSync } from 'node:fs'
import { parsePlanPdf } from './parse.js'
import { embedDocuments } from './embed.js'
import { getDb, closeDb, upsertChunks, ensureVectorIndex, getCollectionStats, COLLECTION_NAME } from './store.js'
import type { PlanChunkDocument } from './types.js'

// Load from root .env.local first, then local .env (local overrides root)
config({ path: resolve(import.meta.dirname, '../../..', '.env.local') })
config({ path: resolve(import.meta.dirname, '..', '.env') })

// ─── Config ─────────────────────────────────────────────────────────────────

const GREENWICH_PDF = resolve(
  import.meta.dirname,
  '../../../Royal_Greenwich_Local_Plan__Core_Strategy_with_Detailed_Policies_main.pdf',
)

const pdfPath   = process.argv[2] ?? GREENWICH_PDF
const council   = process.argv[3] ?? 'Royal Greenwich'
const mongoUri  = process.env.MONGODB_URI
const mongoDb   = process.env.MONGODB_DB  ?? 'cityzenith'
const geminiKey = process.env.GEMINI_API_KEY

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!mongoUri)  throw new Error('MONGODB_URI is not set. Add it to .env.local.')
  if (!geminiKey) throw new Error('GEMINI_API_KEY is not set. Add it to .env.local.')
  if (!existsSync(pdfPath)) throw new Error(`PDF not found: ${pdfPath}`)

  console.log(`\nCityZenith — Council Intelligence Ingest`)
  console.log(`─────────────────────────────────────────`)
  console.log(`  Council : ${council}`)
  console.log(`  PDF     : ${pdfPath}`)
  console.log(`  Database: ${mongoDb}.${COLLECTION_NAME}`)
  console.log()

  // 1. Parse PDF into section chunks
  console.log('1/3  Parsing PDF...')
  const chunks = await parsePlanPdf(pdfPath, council)
  console.log(`     → ${chunks.length} chunks extracted`)

  const sectionBreakdown = chunks.reduce<Record<string, number>>((acc, c) => {
    acc[c.sectionType] = (acc[c.sectionType] ?? 0) + 1
    return acc
  }, {})
  console.log('     Section types:', JSON.stringify(sectionBreakdown))

  // 2. Embed chunks with Gemini text-embedding-004
  console.log('\n2/3  Embedding with Gemini text-embedding-004...')
  // Prepend the section heading to the text for richer semantic context
  const texts = chunks.map((c) => `${c.section}\n\n${c.text}`)
  const vectors = await embedDocuments(texts, geminiKey, true)
  console.log(`     → ${vectors.length} embeddings computed (768 dims)`)

  // 3. Store in MongoDB
  console.log('\n3/3  Storing in MongoDB...')
  const db = await getDb(mongoUri, mongoDb)
  const col = db.collection(COLLECTION_NAME)

  await ensureVectorIndex(col as never)

  const documents: PlanChunkDocument[] = chunks.map((chunk, i) => ({
    ...chunk,
    embedding: vectors[i],
  }))

  await upsertChunks(db, documents)

  const stats = await getCollectionStats(db)
  console.log(`     → ${documents.length} chunks stored`)
  console.log(`     → Collection total: ${stats.total} chunks`)
  console.log()

  await closeDb()

  console.log('✅  Ingestion complete.')
  console.log()
  console.log('   Next: query the store with  npm run query "<your question>"')
  console.log('   Note: If this is the first run on Atlas, the vector index may')
  console.log('         take a few minutes to build before queries return results.')
}

main().catch((err) => {
  console.error('\n❌  Ingestion failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
