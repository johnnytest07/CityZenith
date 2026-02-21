import { Document } from './types';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import pdf from 'pdf-parse';

const PDF_FILES = [
  {
    fileName: 'Royal_Greenwich_Local_Plan__Core_Strategy_with_Detailed_Policies_main.pdf',
    council: 'Royal Borough Greenwich',
  },
  {
    fileName: 'ELP-2039-Reg-18-for-consultation-Planning.pdf',
    council: 'Enfield',
  },
];

const CHUNK_SIZE    = 800;  // characters — sized for Gemini's embedding window
const CHUNK_OVERLAP = 150;

/** Detect whether a line looks like a section heading. */
function isSectionHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 120) return false;
  // Numbered sections: "3.4 Housing Policy" or "Policy H1:"
  if (/^(\d+\.)+\s+\S/.test(trimmed)) return true;
  if (/^Policy\s+[A-Z0-9]+/i.test(trimmed)) return true;
  // All-caps heading of reasonable length
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 4 && trimmed.length < 80) return true;
  return false;
}

/** Guess a sectionType keyword from heading text. */
function classifySectionType(heading: string): string {
  const h = heading.toLowerCase();
  if (/housing|affordable|residential|dwelling/.test(h)) return 'housing';
  if (/transport|travel|highway|parking|pedestrian|cycling/.test(h)) return 'transport';
  if (/green belt|open space|park|ecology|biodiversity|nature/.test(h)) return 'greenspace';
  if (/heritage|conservation|listed|historic/.test(h)) return 'heritage';
  if (/flood|water|drainage|sustainable drainage/.test(h)) return 'flood';
  if (/design|character|appearance|height|density|massing/.test(h)) return 'design';
  if (/employment|economic|business|commercial|retail/.test(h)) return 'employment';
  if (/climate|carbon|energy|renewable|sustainability/.test(h)) return 'climate';
  if (/policy/.test(h)) return 'policy';
  return 'general';
}

interface PagedText {
  text:      string;
  pageStart: number;
}

/**
 * Split the raw PDF text (which uses \f as a page separator) into
 * overlapping chunks, carrying forward the page number and current section.
 */
function chunkPdfText(fullText: string): PagedText[] {
  // Split by form-feed to track page numbers
  const pages = fullText.split('\f');
  const lines: Array<{ text: string; page: number }> = [];
  pages.forEach((pageText, pageIdx) => {
    pageText.split('\n').forEach((line) => {
      lines.push({ text: line, page: pageIdx + 1 });
    });
  });

  const chunks: PagedText[] = [];
  let buffer     = '';
  let bufferPage = 1;
  let i          = 0;

  while (i < lines.length) {
    const { text: line, page } = lines[i];
    const addition = line + '\n';

    if (buffer.length + addition.length > CHUNK_SIZE && buffer.trim().length > 0) {
      chunks.push({ text: buffer.trim(), pageStart: bufferPage });
      // Overlap: rewind by CHUNK_OVERLAP characters worth of lines
      let overlap = '';
      let j = i - 1;
      while (j >= 0 && overlap.length < CHUNK_OVERLAP) {
        overlap = lines[j].text + '\n' + overlap;
        j--;
      }
      buffer     = overlap;
      bufferPage = lines[Math.max(0, j + 1)].page;
    }

    if (buffer === '') bufferPage = page;
    buffer += addition;
    i++;
  }

  if (buffer.trim().length > 0) {
    chunks.push({ text: buffer.trim(), pageStart: bufferPage });
  }

  return chunks;
}

export async function parseCouncilData(): Promise<Omit<Document, 'embedding'>[]> {
  console.log('Parsing data from local PDF files...');

  const documents: Omit<Document, 'embedding'>[] = [];

  for (const fileInfo of PDF_FILES) {
    const filePath = path.join(process.cwd(), fileInfo.fileName);
    console.log(`\nProcessing ${fileInfo.fileName} for ${fileInfo.council}...`);

    try {
      const dataBuffer = await fs.readFile(filePath);
      const pdfData    = await pdf(dataBuffer);
      const chunks     = chunkPdfText(pdfData.text);
      console.log(`  → ${chunks.length} chunks from ${pdfData.numpages} pages`);

      let currentSection     = 'Introduction';
      let currentSectionType = 'general';

      for (const chunk of chunks) {
        // Scan chunk lines for a section heading to carry forward
        for (const line of chunk.text.split('\n')) {
          if (isSectionHeading(line)) {
            currentSection     = line.trim().slice(0, 120);
            currentSectionType = classifySectionType(currentSection);
          }
        }

        documents.push({
          id:          randomUUID(),
          council:     fileInfo.council,
          section:     currentSection,
          sectionType: currentSectionType,
          pageStart:   chunk.pageStart,
          text:        chunk.text,
        });
      }
    } catch (error) {
      console.error(`Failed to process ${fileInfo.fileName}:`, error);
    }
  }

  console.log(`\nTotal chunks parsed: ${documents.length}`);
  return documents;
}
