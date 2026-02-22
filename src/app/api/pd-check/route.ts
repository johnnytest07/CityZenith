import { NextRequest, NextResponse } from 'next/server'
import type { ConstraintType } from '@/types/constraints'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-pro'

export type PDVerdict = 'permitted' | 'prior-approval' | 'full-planning' | 'unclear'

export interface PDCheckResult {
  verdict: PDVerdict
  pdClass: string | null
  conditions: string[]
  restrictions: string[]
  rationale: string
}

function buildPrompt(
  description: string,
  constraints: Partial<Record<ConstraintType, boolean>>,
): string {
  const constraintLines: string[] = []
  if (constraints['conservation-area'])
    constraintLines.push(
      'CONSERVATION AREA — Part 1 Class A (extensions), Class B (roof alterations), Class C (cladding), Class D (porches), Class E (outbuildings), Class G (chimneys), Class H (antennae) are all restricted. Conservation area consent may also be required for demolition of unlisted buildings.',
    )
  if (constraints['article-4'])
    constraintLines.push(
      'ARTICLE 4 DIRECTION — This removes specified permitted development rights (the exact classes removed depend on the direction; assume the most common Article 4 directions affecting residential change of use from C3 to C4/sui generis HMO, and extensions directions, apply unless clearly inapplicable).',
    )
  if (constraints['green-belt'])
    constraintLines.push(
      'GREEN BELT — NPPF policy for Green Belt applies. New buildings are inappropriate development unless they fall within the listed exceptions (replacement dwelling, limited infilling in existing villages, etc.). Permitted development for householder works may still apply within Green Belt for existing dwellings.',
    )
  if (constraints['flood-risk'])
    constraintLines.push(
      'FLOOD RISK ZONE — The site is in Flood Zone 3. Some PD rights under Schedule 2 are restricted: Class A extensions must not increase the floor area of the original dwelling by more than 50% within Flood Zone 3 (Schedule 2, condition a(i)). Other PD classes may carry flood-risk conditions.',
    )
  if (constraintLines.length === 0) constraintLines.push('No statutory constraints identified at this site.')

  return `You are an expert UK planning consultant specialising in permitted development rights under the Town and Country Planning (General Permitted Development) (England) Order 2015 (GPDO) as amended.

TASK: Assess whether the following proposed works at a residential/mixed-use site in England constitute permitted development (PD) under the GPDO, require prior approval, or require a full planning application.

PROPOSED WORKS:
"${description}"

SITE CONSTRAINTS:
${constraintLines.map((l) => `• ${l}`).join('\n')}

INSTRUCTIONS:
1. Identify the most applicable GPDO Part and Class (e.g. "Part 1, Class A — enlargement of a dwellinghouse").
2. Apply any constraint restrictions listed above.
3. Decide the verdict:
   • "permitted" — works fall within a PD class, all conditions and limitations can reasonably be met, no prior approval needed.
   • "prior-approval" — works fall within a PD class but prior approval from the LPA is required before starting.
   • "full-planning" — works are NOT permitted development (either outside any PD class, or a constraint removes the relevant PD right, or the works exceed PD limits).
   • "unclear" — proposal is too vague or ambiguous to determine with confidence.
4. List the key conditions the works must satisfy to be PD (even if verdict is "permitted").
5. List any restrictions or limitations that could tip the verdict toward full planning.
6. Provide a plain-English rationale (2–3 sentences).

Return ONLY valid JSON — no markdown, no explanation outside the JSON:
{
  "verdict": "permitted" | "prior-approval" | "full-planning" | "unclear",
  "pdClass": "<e.g. Part 1, Class A>" or null if no applicable class,
  "conditions": ["<key condition 1>", "<key condition 2>"],
  "restrictions": ["<restriction or risk 1>", "<restriction or risk 2>"],
  "rationale": "<plain English 2–3 sentence summary>"
}`
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 503 })
  }

  let description: string
  let constraints: Partial<Record<ConstraintType, boolean>>
  try {
    const body = await request.json()
    description = body.description
    constraints = body.constraints ?? {}
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!description || description.trim().length < 5) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 })
  }

  const prompt = buildPrompt(description.trim(), constraints)

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

    let result: PDCheckResult
    try {
      const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
      const parsed = JSON.parse(cleaned)

      const validVerdicts: PDVerdict[] = ['permitted', 'prior-approval', 'full-planning', 'unclear']
      if (!validVerdicts.includes(parsed.verdict)) throw new Error('Invalid verdict value')

      result = {
        verdict: parsed.verdict as PDVerdict,
        pdClass: typeof parsed.pdClass === 'string' ? parsed.pdClass : null,
        conditions: Array.isArray(parsed.conditions) ? parsed.conditions.slice(0, 6) : [],
        restrictions: Array.isArray(parsed.restrictions) ? parsed.restrictions.slice(0, 6) : [],
        rationale: typeof parsed.rationale === 'string' ? parsed.rationale : '',
      }
    } catch (e) {
      return NextResponse.json(
        { error: `Parse error: ${e instanceof Error ? e.message : String(e)}` },
        { status: 502 },
      )
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: `Request failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    )
  }
}
