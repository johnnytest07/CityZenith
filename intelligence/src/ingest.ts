import { parseCouncilData } from './parse';
import { embedDocuments } from './embed';
import { uploadDocuments, closeMongoClient } from './store';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local from the project root
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

export async function runIngestionPipeline(): Promise<void> {
  console.log(`--- Starting one-time ingestion pipeline from local PDFs ---`);

  // 1. Parse raw data into document chunks
  const parsedDocs = await parseCouncilData();

  // 2. Create embeddings for each document
  const embeddedDocs = await embedDocuments(parsedDocs);

  // 3. Upload to MongoDB
  await uploadDocuments(embeddedDocs);

  // 4. Close the connection so the process can exit
  await closeMongoClient();

  console.log(`--- Finished ingestion pipeline ---`);
}

// Example of how to run it from the command line
// You could create a script in package.json to run this
// e.g., "ingest": "ts-node -r dotenv/config intelligence/src/ingest.ts"
if (require.main === module) {
  (async () => {
    try {
      await runIngestionPipeline();
    } catch (error) {
      console.error('Ingestion pipeline failed:', error);
      process.exit(1);
    }
  })();
}
