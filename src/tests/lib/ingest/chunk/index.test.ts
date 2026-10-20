import { describe, it, expect } from 'vitest'

import { chunkText } from '@/lib/ingest/chunk'
import { BATCH_SIZE } from '@/lib/common/constants'

describe('chunkText', () => {
  it('uses default batch size from constants', () => {
    const words = Array.from({ length: BATCH_SIZE + 1 }, (_, i) => `word${i}`)
    const result = chunkText(words.join(' '))

    expect(result).toEqual([words.slice(0, BATCH_SIZE).join(' '), words[BATCH_SIZE]])
  })

  it('splits text into correct sized chunks', () => {
    const text = 'one two three four five six seven eight'

    const result = chunkText(text, 2)

    expect(result).toEqual([
      'one two',
      'three four',
      'five six',
      'seven eight',
    ])
  })

  it('handles chunk larger than word count', () => {
    const text = 'one two three'

    const result = chunkText(text, 10)

    expect(result).toEqual(['one two three'])
  })

  it('handles empty string', () => {
    const result = chunkText('')

    expect(result).toEqual([''])
  })
})
