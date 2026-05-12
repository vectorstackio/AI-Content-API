// lib/chunk/index.ts

import * as constants from '@/lib/common/constants'

/**
 * @function chunkText      Split text into chunks ready to insert into Pinecone.
 *
 * @param  {string} text    The text to be chunked.
 * @param  {number} number  The size of each chunk.
 * @return {array}
 */
export const chunkText = (text: string, size: number = constants.BATCH_SIZE): string[] => {
  const words = text.split(' ')
  const chunks: string[] = []

  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size).join(' '))
  }

  return chunks
}