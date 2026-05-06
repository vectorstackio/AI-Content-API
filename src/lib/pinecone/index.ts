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

export async function upsertVectors(params: {
  vectors: {
    id: string
    values: number[]
    metadata: RecordMetadata
  }[]
}) {
  await index.upsert({
    records: params.vectors,
  })
}

export const deleteVectors = async (filters: DeleteByFilter) => {
  await index.deleteMany(filters)
}

export const deleteAll = async () => {
  //console.log('Deleting all vectors')
  await index.deleteMany({ filter: { url: { $exists: true } } })
}