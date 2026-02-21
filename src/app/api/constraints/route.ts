import { NextRequest, NextResponse } from 'next/server'
import { buildConstraintUrl, geometryToBbox } from '@/lib/constraintSources'
import type { ConstraintType } from '@/types/constraints'

export async function POST(request: NextRequest) {
  let body: { constraintType: ConstraintType; geometry: GeoJSON.Geometry }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { constraintType, geometry } = body

  if (!constraintType || !geometry) {
    return NextResponse.json({ error: 'constraintType and geometry are required' }, { status: 400 })
  }

  try {
    const bbox = geometryToBbox(geometry)
    const url = buildConstraintUrl(constraintType, bbox)

    const upstream = await fetch(url, {
      headers: { Accept: 'application/json' },
      // Allow up to 10s for government endpoints which can be slow
      signal: AbortSignal.timeout(10000),
    })

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Constraint endpoint error (${upstream.status})`, constraintType },
        { status: upstream.status },
      )
    }

    const data = await upstream.json()
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to fetch ${constraintType}: ${message}`, constraintType },
      { status: 502 },
    )
  }
}
