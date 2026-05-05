// lib/embed/index.ts

import OpenAI from 'openai'

import * as constants from '@/lib/constants'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function embedChunks(chunks: string[]) {
  const res = await openai.embeddings.create({
    model: constants.EMBEDDING_MODEL,
    input: chunks,
  })

  return res.data.map(d => d.embedding)
}