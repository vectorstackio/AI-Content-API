// lib/pinecone/index.ts

import { Pinecone, RecordMetadata } from '@pinecone-database/pinecone'

import config from '@/lib/config'

type DeleteByFilter = {
  filter: Partial<Record<keyof RecordMetadata, unknown>>
}

const pinecone = new Pinecone({
  apiKey: config.app.pineconeApiKey,
})

const index = pinecone.index(config.app.pineconeIndexName)

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
    metadata: RecordMetadata
  }[]
}) => {
  await index.upsert({
    records: params.vectors,
  })
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