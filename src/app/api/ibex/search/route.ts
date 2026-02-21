import { NextRequest, NextResponse } from 'next/server'

const IBEX_BASE_URL = process.env.IBEX_BASE_URL ?? 'https://api.ibexenterprise.com'

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

  try {
    const upstream = await fetch(`${IBEX_BASE_URL}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    })

    const data = await upstream.json()

    if (!upstream.ok) {
      return NextResponse.json(
        { error: 'Upstream IBEX search error', details: data },
        { status: upstream.status },
      )
    }

    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to reach IBEX: ${message}` }, { status: 502 })
  }
}
