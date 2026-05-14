// lib/common/pinecone/client.ts

import { Pinecone } from '@pinecone-database/pinecone'

import config from '@/lib/common/config'
import type { ChunkMetadata } from '@/types'

const pinecone = new Pinecone({
  apiKey: config.app.pineconeApiKey,
})

export const index = pinecone.index<ChunkMetadata>(
  config.app.pineconeIndexName
)