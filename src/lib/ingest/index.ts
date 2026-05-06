// lib/ingest/index.ts

import crypto from 'crypto'

import { scrapeUrl } from '@/lib/scrape'
import { chunkText } from '@/lib/chunk'
import { embedChunks } from '@/lib/embed'
import { upsertVectors } from '@/lib/pinecone'
import { dbConnect } from '@/lib/db'
import HubAiUrl from '@/lib/db/models/hubAiUrl.model'

export const ingestUrl = async (url: string) => {
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
  await updateDb(url, text)

  return {
    chunks: chunks.length,
  }
}

const updateDb = async (url: string, content: string) => {
  const createHash = (text: string) => {
    return crypto.createHash('sha256').update(text).digest('hex')
  }

  const createHubAiUrl = async (url: string, content: string, contentHash: string) => {
    const hubAiUrl = new HubAiUrl({ url, content, contentHash })
    await hubAiUrl.save()
    return hubAiUrl
  }

  await dbConnect()
  const contentHash = createHash(content)
  const existing = await HubAiUrl.findOne({ url })
  if (existing) {
    if (existing.contentHash === contentHash) {
      throw new Error('The content of URL has not changed')
    }
    existing.content = content
    existing.contentHash = contentHash
    await existing.save()
    return existing
  }
  return createHubAiUrl(url, content, contentHash)
}