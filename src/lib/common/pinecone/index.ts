// lib/common/pinecone/index.ts

import { RecordMetadata, ScoredPineconeRecord } from '@pinecone-database/pinecone'

import { index } from '@/lib/common/pinecone/client'
import type { ChunkMetadata, UserType } from '@/types'

type DeleteByFilter = {
  filter: Partial<Record<keyof RecordMetadata, unknown>>
}

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
  userType?: UserType
  topK?: number
  minScore?: number
}): Promise<ScoredPineconeRecord<ChunkMetadata>[]> => {
  const {
    embedding,
    userType,
    topK = 10,
    minScore = 0.3,
  } = params

  const searchRes = await index.query({
    vector: embedding,

    topK,

    includeMetadata: true,

    ...(userType && {
      filter: {
        userType: {
          $eq: userType,
        },
      },
    }),
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