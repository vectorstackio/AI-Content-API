// lib/ingest/chunk/__tests__/chunk.ts

import { chunkText } from '@/lib/ingest/chunk'

describe('chunkText', () => {
  it('uses default batch size from constants', () => {
    const text = 'one two three four five six'

    const result = chunkText(text)

    expect(result.length).toBeGreaterThan(0)
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