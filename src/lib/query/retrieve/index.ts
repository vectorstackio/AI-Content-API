// lib/query/retrieve/index.ts

import OpenAI from 'openai'
import { ScoredPineconeRecord } from '@pinecone-database/pinecone'

import config from '@/lib/common/config'
import * as constants from '@/lib/common/constants'
import { redis } from '@/lib/common/redis'

import { queryVectors, UserType, ChunkMetadata } from '@/lib/common/pinecone'

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

  const cacheKey = `embedding:${constants.EMBEDDING_MODEL}:${normalizedQuestion}`

  let embedding: number[]

  // 🟢 1. Check Redis cache
  const cachedEmbedding = await redis.get(cacheKey)

  if (cachedEmbedding) {
    embedding = JSON.parse(cachedEmbedding)
  } else {

    // 🟢 2. Generate embedding
    const embeddingRes =
      await openai.embeddings.create({
        model: constants.EMBEDDING_MODEL,
        input: question,
      })

    embedding = embeddingRes.data[0]?.embedding ?? []

    if (!embedding.length) {
      throw new Error('Failed to create embedding')
    }

    // 🟢 3. Cache embedding
    await redis.set(
      cacheKey,
      JSON.stringify(embedding),
      'EX',
      60 * 60 * 24 * 7 // 7 days
    )
  }

  // 🟢 4. Query Pinecone
  const matches = await queryVectors({
    embedding,
    userType,
  })

  return matches
    .filter(hasValidMetadata)
    .map((match) => ({
      text: match.metadata.chunk,
      score: match.score ?? 0,
      source: match.metadata.source,
    }))
}

// export async function retrieveContext({
//   question,
//   userType,
// }: RetrieveContextParams): Promise<RetrievedChunk[]> {
//   const embeddingRes =
//     await openai.embeddings.create({
//       model: constants.EMBEDDING_MODEL,
//       input: question,
//     })

//   const embedding =
//     embeddingRes.data[0]?.embedding

//   if (!embedding) {
//     throw new Error('Failed to create embedding')
//   }

//   const matches = await queryVectors({
//     embedding,
//     userType,
//   })

//   return matches
//     .filter(hasValidMetadata)
//     .map((match) => ({
//       text: match.metadata.chunk,
//       score: match.score ?? 0,
//       source: match.metadata.source,
//     }))
// }

const hasValidMetadata = (
  match: ScoredPineconeRecord<ChunkMetadata>
): match is ScoredPineconeRecord<ChunkMetadata> & {
  metadata: ChunkMetadata
} => {
  return (
    typeof match.metadata?.chunk === 'string'
  )
}


//////////////////////////////////////////////////////////////////////////////////////

// import OpenAI from 'openai'
// import { Pinecone } from '@pinecone-database/pinecone'

// import config from '@/lib/config'
// import * as constants from '@/lib/constants'
// import {
//   queryVectors,
//   UserType,
// } from '@/lib/pinecone'

// const openai = new OpenAI({
//   apiKey: config.app.openAiKey,
// })

// const pinecone = new Pinecone({
//   apiKey: config.app.pineconeApiKey,
// })

// export type UserType = 'pupil' | 'teacher' | 'tutor'

// export type ChunkMetadata = {
//   chunk: string
//   userType: UserType
//   source?: string
// }

// const index = pinecone.index <ChunkMetadata> (
//   config.app.pineconeIndexName
// )

// type RetrieveContextParams = {
//   question: string
//   userType: UserType
// }

// export type RetrievedChunk = {
//   text: string
//   score: number
//   source?: string
// }

// export async function retrieveContext({
//   question,
//   userType,
// }: RetrieveContextParams): Promise<RetrievedChunk[]> {
//   // Create embedding
//   const embeddingRes = await openai.embeddings.create({
//     model: constants.EMBEDDING_MODEL,
//     input: question,
//   })

//   const embedding = embeddingRes.data[0]?.embedding

//   if (!embedding) {
//     throw new Error('Failed to create embedding')
//   }

//   // Query Pinecone
//   const searchRes = await index.query({
//     vector: embedding,
//     topK: 10,
//     includeMetadata: true,

//     filter: {
//       userType: {
//         $eq: userType,
//       },
//     },
//   })

//   const matches =
//     searchRes.matches?.filter((match) => {
//       return (
//         (match.score ?? 0) >= 0.75 &&
//         typeof match.metadata?.chunk === 'string'
//       )
//     }) ?? []

//   return matches.map((match) => ({
//     text: match.metadata!.chunk,
//     score: match.score ?? 0,
//     source: match.metadata?.source,
//   }))
// }