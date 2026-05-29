// lib/common/config/index.ts

import * as dotenv from 'dotenv'

dotenv.config()

const requireEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

const config = {
  app: {
    name: 'Test AI App',
    openAiKey: requireEnv('OPENAI_API_KEY'),
    pineconeApiKey: requireEnv('PINECONE_API_KEY'),
    pineconeIndexName: requireEnv('PINECONE_INDEX_NAME'),
    apiAuthToken: requireEnv('API_AUTH_TOKEN'),
    apiUrl: requireEnv('API_URL'),
  },
  db: {
    url: process.env.DB_URL
  }
}

export type Config = typeof config
export default config
