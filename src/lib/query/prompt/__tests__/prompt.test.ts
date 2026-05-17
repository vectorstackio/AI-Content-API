// lib/query/prompt/__tests__/prompt.test.ts

import { buildPrompt } from '@/lib/query/prompt'

describe('buildPrompt', () => {
  it('builds the system and user messages correctly', () => {
    const result = buildPrompt({
      question: 'What is AI?',
      contextChunks: [
        'AI stands for Artificial Intelligence.',
        'It involves machine learning.',
      ],
    })

    expect(result).toHaveLength(2)

    expect(result[0]).toEqual({
      role: 'system',
      content: expect.stringContaining(
        'Answer ONLY using the provided sources'
      ),
    })

    expect(result[1]).toEqual({
      role: 'user',
      content: expect.stringContaining(`
SOURCES:
[Source 1]
AI stands for Artificial Intelligence.

[Source 2]
It involves machine learning.

QUESTION:
What is AI?
      `),
    })
  })

  it('filters out empty context chunks', () => {
    const result = buildPrompt({
      question: 'Test question',
      contextChunks: [
        'Valid chunk',
        '',
        null as unknown as string,
        undefined as unknown as string,
      ],
    })

    expect(result[1].content).toContain('[Source 1]\nValid chunk')

    expect(result[1].content).not.toContain('[Source 2]')
  })

  it('handles an empty context array', () => {
    const result = buildPrompt({
      question: 'Unknown question',
      contextChunks: [],
    })

    expect(result[1].content).toContain('SOURCES:')

    expect(result[1].content).toContain('QUESTION:\nUnknown question')
  })
})