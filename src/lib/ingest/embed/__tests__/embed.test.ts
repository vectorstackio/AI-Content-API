// lib/ingest/embed/__tests__/embed.test.ts

const response = {
  data: [
    { embedding: [0.1, 0.2] },
    { embedding: [0.3, 0.4] },
  ],
}

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn(() => ({
      embeddings: {
        create: jest.fn(() => response),
      },
    })),
  }
})

jest.mock('@/lib/common/constants', () => ({
  EMBEDDING_MODEL: 'test-model',
}))

import OpenAI from 'openai'
import { embedChunks } from '@/lib/ingest/embed'
//import * as constants from '@/lib/common/constants'

describe('embedChunks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls OpenAI correctly', async () => {
    const openaiInstance = new OpenAI()
    const mockCreate = openaiInstance.embeddings.create as jest.Mock

    mockCreate.mockResolvedValue({
      data: [
        { embedding: [0.1, 0.2] },
        { embedding: [0.3, 0.4] },
      ],
    })

    const result = await embedChunks(['hello', 'world'])

    expect(result).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ])
  })
})