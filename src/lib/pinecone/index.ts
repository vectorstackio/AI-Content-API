// lib/pinecone/index.ts

import { Pinecone, RecordMetadata } from '@pinecone-database/pinecone'

import config from '@/lib/config'

export type UserType =
  | 'pupil'
  | 'teacher'
  | 'tutor'

export type ChunkMetadata = {
  chunk: string
  userType: UserType
  source?: string
  url?: string
}

type DeleteByFilter = {
  filter: Partial<Record<keyof RecordMetadata, unknown>>
}

const pinecone = new Pinecone({
  apiKey: config.app.pineconeApiKey,
})

const index = pinecone.index<ChunkMetadata>(config.app.pineconeIndexName)

/**
 * @function upsertVectors  Upsert vectors into Pinecone.
 *
 * @param  {object} params  The data being upserted.
 * @return {void}
 */
export const upsertVectors = async (params: {
  vectors: {
    id: string
    values: number[]
    metadata: ChunkMetadata
  }[]
}) => {
  await index.upsert({
    records: params.vectors,
  })
}

/**
 * @function queryVectors  Query vectors in Pinecone.
 *
 * @param  {object} params  The filters being used to query vectors in Pinecone.
 * @return {Array}          The vectors that were found
 */
export const queryVectors = async (params: {
  embedding: number[]
  userType: UserType
  topK?: number
  minScore?: number
}) => {
  const {
    embedding,
    userType,
    topK = 10,
    minScore = 0.75,
  } = params

  const searchRes = await index.query({
    vector: embedding,

    topK,

    includeMetadata: true,

    filter: {
      userType: {
        $eq: userType,
      },
    },
  })

  return (
    searchRes.matches?.filter((match) => {
      return (
        (match.score ?? 0) >= minScore &&
        typeof match.metadata?.chunk === 'string'
      )
    }) ?? []
  )
}

/**
 * @function deleteVectors  Delete some vectors in Pinecone.
 *
 * @param  {object} filters The filters used to dtermine what to delete.
 * @return {void}
 */
export const deleteVectors = async (filters: DeleteByFilter) => {
  await index.deleteMany(filters)
}

/**
 * @function deleteAll  Delete all vectors in Pinecone. *** ONLY TO BE USED IN DEVELOPMENT ***
 *
 * @return {void}
 */
export const deleteAll = async () => {
  //console.log('Deleting all vectors')
  await index.deleteMany({ filter: { url: { $exists: true } } })
}