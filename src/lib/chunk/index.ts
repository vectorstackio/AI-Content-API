// lib/chunk/index.ts

import * as constants from '@/lib/constants'

export function chunkText(text: string, size = constants.BATCH_SIZE): string[] {
  const words = text.split(' ')
  const chunks: string[] = []

  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size).join(' '))
  }

  return chunks
}