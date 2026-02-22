import { NextRequest, NextResponse } from 'next/server'

/**
 * Admin POST endpoint to pre-run council analysis and cache it to MongoDB.
 * Call this before a demo to ensure instant replay from cache.
 *
 * Body: { region: string, bounds: [w,s,e,n], council: string, planCorpus?: string }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: {
    region: string
    bounds: [number, number, number, number]
    council: string
    planCorpus?: string | null
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { region, bounds, council, planCorpus = null } = body

  if (!region || !bounds || !council) {
    return NextResponse.json(
      { error: 'region, bounds, and council are required' },
      { status: 400 },
    )
  }

  // Trigger the analyse endpoint internally — it will run the full pipeline
  // and write to MongoDB cache at the end.
  try {
    const baseUrl = req.nextUrl.origin
    const analyseRes = await fetch(`${baseUrl}/api/council/analyse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region, bounds, council, planCorpus }),
    })

    if (!analyseRes.ok) {
      return NextResponse.json(
        { error: `Analyse endpoint returned ${analyseRes.status}` },
        { status: 502 },
      )
    }

    // Consume the SSE stream fully to let the pipeline complete
    const reader = analyseRes.body?.getReader()
    if (!reader) {
      return NextResponse.json({ error: 'No response body' }, { status: 502 })
    }

    let totalSuggestions = 0
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // Parse complete events from buffer
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      let currentEvent = ''
      let currentData = ''

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          currentData = line.slice(6).trim()
        } else if (line === '' && currentEvent === 'complete' && currentData) {
          try {
            const payload = JSON.parse(currentData) as { totalSuggestions?: number }
            totalSuggestions = payload.totalSuggestions ?? 0
          } catch {
            // ignore
          }
          currentEvent = ''
          currentData = ''
        }
      }
    }

    return NextResponse.json({
      ok: true,
      region,
      totalSuggestions,
      message: `Analysis for "${region}" cached successfully with ${totalSuggestions} suggestions.`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Preload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
