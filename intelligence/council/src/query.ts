/**
 * Semantic search over ingested local plan chunks.
 *
 * Usage:
 *   npm run query "<question>"
 *   npm run query "affordable housing policy" --limit 8
 *   npm run query "flood risk" --section-type policy
 *   npm run query "tall buildings" --council "Royal Greenwich" --limit 5
 *
 * Flags:
 *   --limit <n>          Number of results (default 5)
 *   --section-type <t>   Filter to: chapter | policy | appendix | supporting-text
 *   --council <name>     Filter to a specific council
 */

import 'dotenv/config'
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { embedQuery } from './embed.js'
import { getDb, closeDb, searchChunks, COLLECTION_NAME } from './store.js'

config({ path: resolve(import.meta.dirname, '../../..', '.env.local') })
config({ path: resolve(import.meta.dirname, '..', '.env') })

// ─── Arg parsing ────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): {
  query:       string
  limit:       number
  sectionType: string | undefined
  council:     string | undefined
} {
  const args  = argv.slice(2)
  const flags: Record<string, string> = {}
  const positional: string[] = []

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      flags[args[i].slice(2)] = args[i + 1] ?? ''
      i++
    } else {
      positional.push(args[i])
    }
  }

  return {
    query:       positional.join(' ').trim(),
    limit:       flags['limit'] ? parseInt(flags['limit'], 10) : 5,
    sectionType: flags['section-type'],
    council:     flags['council'],
  }
}

// ─── Display helpers ─────────────────────────────────────────────────────────

const SECTION_TYPE_BADGE: Record<string, string> = {
  policy:           '📋 Policy',
  chapter:          '📖 Chapter',
  appendix:         '📎 Appendix',
  'supporting-text':'📝 Supporting text',
}

function truncate(text: string, maxLen: number): string {
  return text.length <= maxLen ? text : text.slice(0, maxLen - 3) + '...'
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const mongoUri  = process.env.MONGODB_URI
  const mongoDb   = process.env.MONGODB_DB  ?? 'cityzenith'
  const geminiKey = process.env.GEMINI_API_KEY

  if (!mongoUri)  throw new Error('MONGODB_URI is not set.')
  if (!geminiKey) throw new Error('GEMINI_API_KEY is not set.')

  const { query, limit, sectionType, council } = parseArgs(process.argv)

  if (!query) {
    console.error('Usage:  npm run query "<question>"')
    console.error('Example: npm run query "affordable housing requirements"')
    process.exit(1)
  }

  console.log(`\nCityZenith — Council Plan Search`)
  console.log(`────────────────────────────────`)
  console.log(`  Query       : "${query}"`)
  if (sectionType) console.log(`  Section type: ${sectionType}`)
  if (council)     console.log(`  Council     : ${council}`)
  console.log(`  Results     : up to ${limit}`)
  console.log()

  console.log('Embedding query...')
  const queryVector = await embedQuery(query, geminiKey)

  const db = await getDb(mongoUri, mongoDb)

  console.log(`Searching ${COLLECTION_NAME}...\n`)
  const results = await searchChunks(db, queryVector, { limit, sectionType, council })

  await closeDb()

  if (results.length === 0) {
    console.log('No results found.')
    console.log('Check that the index has finished building in Atlas.')
    return
  }

  results.forEach((r, i) => {
    const badge = SECTION_TYPE_BADGE[r.chunk.sectionType] ?? r.chunk.sectionType
    console.log(`── Result ${i + 1}  (score: ${r.score.toFixed(4)}) ──────────────────────────`)
    console.log(`  ${badge}  |  ${r.chunk.council}  |  Page ${r.chunk.pageStart}`)
    console.log(`  Section: ${r.chunk.section}`)
    console.log()
    console.log(`  ${truncate(r.chunk.text, 400)}`)
    console.log()
  })
}

main().catch((err) => {
  console.error('Query failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
