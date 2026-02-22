import { NextResponse } from 'next/server'
import { fetchDocumentsByCouncil } from '@/intelligence/store'

export async function POST(request: Request) {
  const { council, planCorpus } = await request.json()
  const key = planCorpus ?? council

  if (!key) {
    return NextResponse.json({ error: 'planCorpus or council name is required' }, { status: 400 })
  }

  try {
    const start = Date.now()
    const documents = await fetchDocumentsByCouncil(key)
    const ms = Date.now() - start
    console.log(`Fetched ${documents.length} intelligence documents for ${key} in ${ms}ms`)
    return NextResponse.json(documents)
  } catch (error) {
    console.error(`Error fetching documents for ${key}:`, error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to fetch documents: ${errorMessage}` }, { status: 500 })
  }
}
