import { readFileSync } from 'node:fs'
import pdf from 'pdf-parse'
import type { PlanChunk, SectionType } from './types.js'

// ─── Configuration ─────────────────────────────────────────────────────────

const MAX_CHUNK_CHARS = 900   // split a section when it exceeds this length
const MIN_CHUNK_CHARS = 60    // discard chunks shorter than this (usually noise)

// ─── Heading detection ──────────────────────────────────────────────────────

/**
 * Regex patterns for identifying section headings in a UK planning document.
 * Order matters — first match wins.
 */
const HEADING_PATTERNS: Array<{ type: SectionType; re: RegExp }> = [
  // Policy identifier: "Policy H1:", "Policy SA(BE) 1:", "Policy DH(a)1:"
  {
    type: 'policy',
    re: /^Policy\s+[A-Z][A-Z\d()]*\s*\d*[a-z]?\s*:/i,
  },
  // Appendix heading: "Appendix 1", "APPENDIX A:"
  {
    type: 'appendix',
    re: /^(Appendix|APPENDIX)\s+[A-Z0-9]/i,
  },
  // Numbered top-level chapter: "1 INTRODUCTION", "2 SPATIAL STRATEGY"
  // (digit then space then all-caps words, 2–8 words total)
  {
    type: 'chapter',
    re: /^\d{1,2}\s+[A-Z][A-Z ]{3,60}$/,
  },
  // Labelled chapter: "CHAPTER 1:", "PART A:", "SECTION 2 –"
  {
    type: 'chapter',
    re: /^(CHAPTER|PART|SECTION)\s+[A-Z0-9]/i,
  },
  // Numbered sub-section: "1.1 Background", "2.3.4 Policy Context"
  // (treat as supporting-text since it sits beneath a chapter)
  {
    type: 'supporting-text',
    re: /^\d+\.\d+(\.\d+)?\s+[A-Z][a-z]/,
  },
]

function detectHeading(line: string): { type: SectionType; text: string } | null {
  const t = line.trim()
  if (t.length < 4 || t.length > 130) return null

  for (const { type, re } of HEADING_PATTERNS) {
    if (re.test(t)) return { type, text: t }
  }
  return null
}

// ─── Per-page text extraction ───────────────────────────────────────────────

interface TextItem {
  str:    string
  hasEOL: boolean
}

interface PageText {
  pageNum: number
  lines:   string[]
}

/** Render one PDF page to an ordered array of non-empty text lines. */
function renderPageLines(pageNum: number, items: TextItem[]): PageText {
  const lines: string[] = []
  let current = ''

  for (const item of items) {
    // Normalise ligatures and common Unicode replacements
    const s = item.str
      .replace(/\uFB01/g, 'fi')
      .replace(/\uFB02/g, 'fl')
      .replace(/\u2013/g, '-')
      .replace(/\u2014/g, ' - ')
      .replace(/\u2019/g, "'")

    current += s

    if (item.hasEOL) {
      const line = current.replace(/\s+/g, ' ').trim()
      if (line) lines.push(line)
      current = ''
    } else {
      current += ' '
    }
  }

  const remaining = current.replace(/\s+/g, ' ').trim()
  if (remaining) lines.push(remaining)

  return { pageNum, lines }
}

// ─── Chunker ────────────────────────────────────────────────────────────────

/**
 * Accumulate lines under a section heading until we hit MAX_CHUNK_CHARS,
 * then flush a chunk. Each flush preserves the section heading as context.
 */
function makeChunker(
  source:    string,
  council:   string,
  onChunk:   (chunk: Omit<PlanChunk, 'chunkId' | 'chunkIndex'>) => void,
) {
  let section:     string      = 'Preamble'
  let sectionType: SectionType = 'supporting-text'
  let buffer:      string      = ''
  let bufferPage:  number      = 1

  function flush(currentPage: number) {
    const text = buffer.replace(/\s+/g, ' ').trim()
    if (text.length >= MIN_CHUNK_CHARS) {
      onChunk({ source, council, section, sectionType, pageStart: bufferPage, text, charCount: text.length })
    }
    buffer = ''
    bufferPage = currentPage
  }

  function feed(line: string, pageNum: number) {
    const heading = detectHeading(line)
    if (heading) {
      flush(pageNum)
      section     = heading.text
      sectionType = heading.type
      bufferPage  = pageNum
      return
    }

    // Skip obvious header/footer noise: page numbers, repeated doc titles
    if (/^\d+$/.test(line.trim())) return             // lone page number
    if (line.trim().length < 4)   return              // too short to be content

    if (buffer.length + line.length + 1 > MAX_CHUNK_CHARS) {
      flush(pageNum)
    }
    buffer += (buffer ? ' ' : '') + line
  }

  function finalFlush(lastPage: number) {
    flush(lastPage)
  }

  return { feed, finalFlush }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Parse a local plan PDF and return an ordered array of PlanChunks.
 *
 * Chunks are split at section heading boundaries and at MAX_CHUNK_CHARS.
 * Every chunk carries the section heading and page number it originated from.
 */
export async function parsePlanPdf(
  pdfPath: string,
  council: string,
): Promise<PlanChunk[]> {
  const buffer = readFileSync(pdfPath)
  const source = pdfPath.split('/').pop() ?? pdfPath

  const pages: PageText[] = []

  // pdf-parse fires pagerender for every page during parsing
  await pdf(buffer, {
    pagerender(pageData: { pageIndex: number; getTextContent: () => Promise<{ items: TextItem[] }> }) {
      return pageData.getTextContent().then(({ items }) => {
        const page = renderPageLines(pageData.pageIndex + 1, items)
        pages.push(page)
        return page.lines.join('\n')
      })
    },
  })

  const rawChunks: Omit<PlanChunk, 'chunkId' | 'chunkIndex'>[] = []
  const chunker = makeChunker(source, council, (c) => rawChunks.push(c))

  for (const { pageNum, lines } of pages) {
    for (const line of lines) {
      chunker.feed(line, pageNum)
    }
  }
  chunker.finalFlush(pages.at(-1)?.pageNum ?? 1)

  return rawChunks.map((c, i) => ({
    ...c,
    chunkId:    crypto.randomUUID(),
    chunkIndex: i,
  }))
}
