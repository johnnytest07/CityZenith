import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongoClient'

/**
 * DELETE /api/council/clear-cache
 *
 * Clears cached council analysis from MongoDB.
 *
 * Body (optional):
 *   { region: string }  — deletes only that region's cache entry
 *   {}                  — deletes ALL cached entries
 *
 * Returns: { ok: true, deleted: number }
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  let region: string | undefined

  try {
    const body = await req.json().catch(() => ({})) as { region?: string }
    region = body.region
  } catch {
    // no body — clear all
  }

  try {
    const client = await clientPromise
    const db = client.db(process.env.MONGODB_DB ?? 'cityzenith')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collection = db.collection('council_analysis_cache') as any

    let deleted = 0
    if (region) {
      const result = await collection.deleteOne({ _id: region })
      deleted = result.deletedCount ?? 0
    } else {
      const result = await collection.deleteMany({})
      deleted = result.deletedCount ?? 0
    }

    return NextResponse.json({ ok: true, deleted, region: region ?? 'all' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to clear cache'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
