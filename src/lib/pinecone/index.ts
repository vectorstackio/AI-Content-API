// lib/pinecone/index.ts

import { Pinecone } from '@pinecone-database/pinecone'

import config from '@/lib/config'

import type { RecordMetadata } from '@pinecone-database/pinecone'

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

export const deleteAll = async () => {
  //console.log('Deleting all vectors')
  await index.deleteMany({ filter: { url: { $exists: true } } })
}