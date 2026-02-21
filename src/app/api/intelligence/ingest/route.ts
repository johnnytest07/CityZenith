import { NextResponse } from 'next/server';
import { runIngestionPipeline } from '@/intelligence/ingest'

export async function POST(request: Request) {
  const { council } = await request.json();

  if (!council) {
    return NextResponse.json({ error: 'Council name is required' }, { status: 400 });
  }

  try {
  // No await here, run in background
  // runIngestionPipeline currently doesn't accept a council parameter
  // call it without arguments so the ingestion script runs with its own config
  void runIngestionPipeline();
    return NextResponse.json({ message: `Ingestion pipeline started for ${council}.` });
  } catch (error) {
    console.error(`Ingestion pipeline API error for ${council}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to start ingestion pipeline: ${errorMessage}` }, { status: 500 });
  }
}
