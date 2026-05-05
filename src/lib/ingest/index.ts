// lib/ingest/index.ts

import { scrapeUrl } from '@/lib/scrape'
import { chunkText } from '@/lib/chunk'
import { embedChunks } from '@/lib/embed'
import { upsertVectors } from '@/lib/pinecone'

export async function ingestUrl(url: string) {
  if (!url) throw new Error('URL is required')

  // 1. Scrape
  const text = await scrapeUrl(url)

  if (!text || text.length < 50) {
    throw new Error('No usable content scraped from URL')
  }

  // 2. Chunk
  const chunks = chunkText(text)

  if (!chunks.length) {
    throw new Error('No chunks generated from content')
  }

  // 3. Embed
  const embeddings = await embedChunks(chunks)

  // 4. Upsert to Pinecone
  const vectors = chunks.map((chunk, i) => ({
    id: `${url}-chunk-${i}`,
    values: embeddings[i],
    metadata: {
      url,
      chunk,
      chunkIndex: i,
    },
  }))

  await upsertVectors({ vectors })

  return {
    chunks: chunks.length,
  }
}