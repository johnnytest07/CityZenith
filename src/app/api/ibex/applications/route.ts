import { NextRequest, NextResponse } from 'next/server'

const IBEX_BASE_URL = process.env.IBEX_BASE_URL ?? 'https://ibex.seractech.co.uk'

export async function POST(request: NextRequest) {
  const apiKey = process.env.IBEX_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'IBEX_API_KEY not configured' }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const upstreamUrl = `${IBEX_BASE_URL}/applications`
  console.log('[/api/ibex/applications] → upstream URL:', upstreamUrl)
  console.log('[/api/ibex/applications] → request body:', JSON.stringify(body, null, 2))

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })

    const rawText = await upstream.text()
    console.log(`[/api/ibex/applications] ← status=${upstream.status}`)
    console.log('[/api/ibex/applications] ← response body:', rawText.slice(0, 2000))

    let data: unknown
    try {
      data = JSON.parse(rawText)
    } catch {
      return NextResponse.json(
        { error: 'Upstream returned non-JSON', raw: rawText.slice(0, 500) },
        { status: 502 },
      )
    }

    if (!upstream.ok) {
      console.error('[/api/ibex/applications] upstream error:', upstream.status, data)
      return NextResponse.json(
        { error: 'Upstream IBEX applications error', details: data },
        { status: upstream.status },
      )
    }

    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[/api/ibex/applications] fetch exception:', message)
    return NextResponse.json({ error: `Failed to reach IBEX: ${message}` }, { status: 502 })
  }
}
