// lib/query/retrieve/index.ts

import OpenAI from 'openai'
import { ScoredPineconeRecord } from '@pinecone-database/pinecone'

import config from '@/lib/common/config'
import * as constants from '@/lib/common/constants'
import { redis } from '@/lib/common/redis'

import { queryVectors, UserType, ChunkMetadata } from '@/lib/common/pinecone'

const MIN_SCORE = 0.4

const openai = new OpenAI({
  apiKey: config.app.openAiKey,
})

type RetrieveContextParams = {
  question: string
  userType: UserType
  userId?: string
}

export type RetrievedChunk = {
  text: string
  score: number
  source?: string
}

export async function retrieveContext({
  question,
  userType,
}: RetrieveContextParams): Promise<RetrievedChunk[]> {

  const normalizedQuestion = question.trim().toLowerCase()

  // 🟢 VERSIONED CACHE KEY
  const retrievalCacheKey = `retrieval:v1:${userType}:${normalizedQuestion}`

  // 🟢 1. CHECK RETRIEVAL CACHE
  const cachedRetrieval = await redis.get(retrievalCacheKey)

  if (cachedRetrieval) {
    return JSON.parse(cachedRetrieval)
  }

  // -----------------------------
  // EMBEDDING CACHE
  // -----------------------------

  const embeddingCacheKey = `embedding:${constants.EMBEDDING_MODEL}:${normalizedQuestion}`

  let embedding: number[]

  const cachedEmbedding = await redis.get(embeddingCacheKey)

  if (cachedEmbedding) {
    embedding = JSON.parse(cachedEmbedding)
  } else {

    const embeddingRes =
      await openai.embeddings.create({
        model: constants.EMBEDDING_MODEL,
        input: question,
      })

    embedding = embeddingRes.data[0]?.embedding ?? []

    if (!embedding.length) {
      throw new Error(
        'Failed to create embedding'
      )
    }

    await redis.set(
      embeddingCacheKey,
      JSON.stringify(embedding),
      'EX',
      60 * 60 * 24 * 7
    )
  }

  // -----------------------------
  // PINECONE QUERY
  // -----------------------------

  const matches = await queryVectors({
    embedding,
    userType,
  })

  const results = matches
    .filter(hasValidMetadata)
    .filter((match) => (match.score ?? 0) > MIN_SCORE)
    .map((match) => ({
      text: match.metadata.chunk,
      score: match.score ?? 0,
      source: match.metadata.source,
    }))

  // 🟢 CACHE RETRIEVAL RESULTS
  await redis.set(
    retrievalCacheKey,
    JSON.stringify(results),
    'EX',
    60 * 60 // 1 hour
  )

  return results
}

const hasValidMetadata = (
  match: ScoredPineconeRecord<ChunkMetadata>
): match is ScoredPineconeRecord<ChunkMetadata> & {
  metadata: ChunkMetadata
} => {
  return (
    typeof match.metadata?.chunk === 'string'
  )
}