import { NextRequest, NextResponse } from 'next/server'
import type { ProjectBuilding, ProjectType, ApprovalLikelihood } from '@/types/project'
import type { SiteContext } from '@/types/siteContext'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-pro'

const PROJECT_DESCRIPTIONS: Record<ProjectType, string> = {
  'renovation':       'renovation or refurbishment of the existing building',
  'new-build':        'erection of a new building on this site',
  'demolish-rebuild': 'demolition of the existing building and erection of a new building',
  'extension':        'extension to the existing building (rear, side, loft or basement)',
  'change-of-use':    'change of use of the building to a different use class',
  'subdivision':      'subdivision of the existing building into multiple residential units',
}

function buildPrompt(
  projectType: ProjectType,
  building: ProjectBuilding,
  siteContext?: SiteContext,
): string {
  const { heightM, buildingType, buildingUse, impliedStoreys, lngLat, footprintM2 } = building

  // Format constraints
  const constraintLines: string[] = []
  if (siteContext?.statutoryConstraints) {
    const c = siteContext.statutoryConstraints
    if (c['green-belt']?.intersects)      constraintLines.push('GREEN BELT — new-build flats excluded, small-scale only')
    if (c['conservation-area']?.intersects) constraintLines.push('CONSERVATION AREA — traditional materials required')
    if (c['article-4']?.intersects)       constraintLines.push('ARTICLE 4 — permitted development rights removed')
    if (c['flood-risk']?.intersects)      constraintLines.push('FLOOD RISK ZONE — sequential test required')
  }

  // Format planning precedents — decided applications only, most recent 40
  let precedentSection = 'No local planning history available.'
  if (siteContext?.planningPrecedentFeatures?.features?.length) {
    const decided = siteContext.planningPrecedentFeatures.features
      .filter((f) => {
        const d = (f.properties?.normalised_decision ?? '').toLowerCase()
        return d && d !== 'undetermined'
      })
      .sort((a, b) => {
        const da = String(a.properties?.decided_date ?? '')
        const db = String(b.properties?.decided_date ?? '')
        return db.localeCompare(da)
      })
      .slice(0, 40)

    if (decided.length > 0) {
      const lines = decided.map((f, i) => {
        const p = f.properties ?? {}
        const ref  = p.planning_reference ?? `#${i + 1}`
        const type = p.normalised_application_type ?? p.application_type ?? 'Unknown'
        const prop = String(p.proposal ?? '').slice(0, 90)
        const dec  = String(p.normalised_decision ?? 'Unknown').toUpperCase()
        const date = p.decided_date ? String(p.decided_date).slice(0, 7) : ''
        return `${i + 1}. [${ref}] ${type} — "${prop}${prop.length >= 90 ? '…' : ''}" → ${dec}${date ? ` (${date})` : ''}`
      })
      precedentSection = `${decided.length} decided applications within ~500m (most recent first):\n${lines.join('\n')}`
    }
  }

  return `You are a UK planning consultant. Assess the likelihood of planning approval for the project described below using ONLY the local planning history provided — do not invent precedents.

PROJECT: ${PROJECT_DESCRIPTIONS[projectType]}

BUILDING:
  Location: ${lngLat[1].toFixed(5)}°N, ${lngLat[0].toFixed(5)}°E
  Type: ${buildingType ?? 'unknown'} | Use: ${buildingUse ?? 'unknown'}
  Height: ${heightM != null ? `${heightM}m` : 'unknown'} | Storeys: ${impliedStoreys ?? 'unknown'}
  Footprint: ${footprintM2 != null ? `${Math.round(footprintM2)}m²` : 'unknown'}

STATUTORY CONSTRAINTS:
${constraintLines.length > 0 ? constraintLines.map((c) => `  • ${c}`).join('\n') : '  • None identified'}

LOCAL PLANNING HISTORY:
${precedentSection}

Return ONLY valid JSON:
{
  "percent": <integer 0–100>,
  "confidence": "high" | "medium" | "low",
  "summary": "<2–3 sentences — cite specific local case refs and numbers, be honest when evidence is thin>",
  "supportingPrecedents": ["<ref + brief outcome>"],
  "riskFactors": ["<specific risk grounded in evidence or constraints>"],
  "comparableCases": <integer — how many applications in the list are directly comparable to the proposed project>
}

Rules:
- confidence "high" if ≥5 comparable cases; "medium" if 2–4; "low" if 0–1
- supportingPrecedents: 2–3 items citing actual refs where available
- riskFactors: 2–3 items — if no refusals found, cite the constraint risks instead
- Do not be falsely optimistic — if precedent is absent, percent should reflect uncertainty`
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 503 })
  }

  let projectType: ProjectType
  let building: ProjectBuilding
  let siteContext: SiteContext | undefined
  try {
    const body = await request.json()
    projectType = body.projectType
    building = body.building
    siteContext = body.siteContext
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!projectType || !building?.lngLat) {
    return NextResponse.json({ error: 'projectType and building are required' }, { status: 400 })
  }

  const prompt = buildPrompt(projectType, building, siteContext)

  const geminiBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingBudget: 512 },
    },
  }

  try {
    const res = await fetch(
      `${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) },
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json({ error: `Gemini API error (${res.status})`, details: err }, { status: res.status })
    }

    const data = await res.json()
    const parts: Array<{ text?: string; thought?: boolean }> = data?.candidates?.[0]?.content?.parts ?? []
    const text = parts.find((p) => p.text && !p.thought)?.text ?? ''

    if (!text) return NextResponse.json({ error: 'Empty response from Gemini' }, { status: 502 })

    let result: ApprovalLikelihood
    try {
      const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
      const parsed = JSON.parse(cleaned)

      if (
        typeof parsed.percent !== 'number' ||
        !['high', 'medium', 'low'].includes(parsed.confidence) ||
        typeof parsed.summary !== 'string'
      ) throw new Error('Missing required fields')

      result = {
        percent: Math.min(100, Math.max(0, Math.round(parsed.percent))),
        confidence: parsed.confidence,
        summary: parsed.summary,
        supportingPrecedents: Array.isArray(parsed.supportingPrecedents) ? parsed.supportingPrecedents.slice(0, 3) : [],
        riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors.slice(0, 3) : [],
        comparableCases: typeof parsed.comparableCases === 'number' ? parsed.comparableCases : 0,
      }
    } catch (e) {
      return NextResponse.json({ error: `Parse error: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 })
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: `Request failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 502 })
  }
}
