// app/api/ingest/route.ts

import OpenAI from 'openai'
import { Pinecone } from '@pinecone-database/pinecone'

import { NextRequest, NextResponse } from 'next/server'

import config from '@/lib/config'
import * as constants from '@/lib/constants'
//import { scrapeUrl } from '@/lib/scrape'

export const runtime = 'nodejs'

const openai = new OpenAI({
  apiKey: config.app.openAiKey,
})

const pc = new Pinecone({
  apiKey: config.app.pineconeApiKey,
})

const index = pc.index(config.app.pineconeIndexName)

const DEFAULT_DOCS = [
  'LangChain helps developers build LLM-based apps.',
  'Pinecone stores and searches vector embeddings.',
  'OpenAI provides the GPT-4 language model.',
]

type IngestResponse =
  | { success: true; count: number }
  | { success: false; error: string }

export async function POST(req: NextRequest): Promise<NextResponse<IngestResponse>> {
  try{
    //const test = await scrapeUrl()
    //console.log(test)

    const body = await req.json().catch(() => null)

    const docs: string[] =
      Array.isArray(body?.documents) && body.documents.length > 0
        ? body.documents
        : DEFAULT_DOCS

    // 1. Create embeddings
    const embeddingRes = await openai.embeddings.create({
      model: constants.EMBEDDING_MODEL,
      input: docs,
    })

    // 2. Format for Pinecone
    const vectors = embeddingRes.data.map((e, i) => ({
      id: `doc-${i}-${Date.now()}`,
      values: e.embedding,
      metadata: {
        text: docs[i],
      },
    }))

    // 3. Upsert (batching for safety)
    for (let i = 0; i < vectors.length; i += constants.BATCH_SIZE) {
      const batch = vectors.slice(i, i + constants.BATCH_SIZE)
      await index.upsert({ records: batch })
    }

    return NextResponse.json({
      success: true,
      count: vectors.length,
    })
  } catch (err) {
    //console.error('Ingest error:', err)

    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    data: 'Ingest',
  })
}