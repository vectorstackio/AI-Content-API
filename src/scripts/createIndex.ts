// scripts/createIndex.ts

import { Pinecone } from '@pinecone-database/pinecone'
import * as dotenv from 'dotenv'

dotenv.config()

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
})

async function createIndex() {
  const indexName = process.env.PINECONE_INDEX_NAME!

  const existingIndexes = await pc.listIndexes()
  const exists = existingIndexes.indexes?.some(i => i.name === indexName)

  if (exists) {
    console.log('Index already exists')
    return
  }

  await pc.createIndex({
    name: indexName,
    dimension: 1536,
    metric: 'cosine',
    spec: {
      serverless: {
        cloud: 'aws',
        region: 'us-east-1',
      },
    },
  })

  // await pc.createIndex({
  //   name: indexName,
  //   dimension: 1536, // MUST match OpenAI embedding model
  //   metric: 'cosine',
  // })

  console.log('Index created:', indexName)
}

createIndex().catch(console.error)