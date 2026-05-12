// lib/embed/index.ts

import OpenAI from 'openai'

import * as constants from '@/lib/common/constants'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/**
 * @function embedChunks  Use OpenAI to convert chunked content into data ready to insert nto Pinecone.
 *
 * @param  {array} chunks The chunked strings.
 * @return {array}        Data ready to insert into Pinecone.
 */
export const embedChunks = async (chunks: string[]) => {
  const res = await openai.embeddings.create({
    model: constants.EMBEDDING_MODEL,
    input: chunks,
  })

  return res.data.map(d => d.embedding)
}