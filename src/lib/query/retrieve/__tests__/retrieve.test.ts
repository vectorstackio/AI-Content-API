// src/lib/query/retrieve/__tests__/retrieve.test.ts

import { retrieveContext } from '@/lib/query/retrieve'
import { redis } from '@/lib/common/redis'
import { queryVectors } from '@/lib/common/pinecone'
//import OpenAI from 'openai'
import type { ScoredPineconeRecord } from '@pinecone-database/pinecone'
import type { ChunkMetadata, UserType } from '@/types'

jest.mock('@/lib/common/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
  },
}))

jest.mock('@/lib/common/pinecone', () => ({
  queryVectors: jest.fn(),
}))

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

const mockedRedis = redis as jest.Mocked<typeof redis>
const mockedQueryVectors = queryVectors as jest.MockedFunction<
  typeof queryVectors
>

describe('retrieveContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns cached retrieval if present', async () => {
    mockedRedis.get.mockResolvedValueOnce(
      JSON.stringify([
        { text: 'cached', score: 1, source: 'x' },
      ])
    )

    const result = await retrieveContext({
      question: 'Hello',
      userType: 'pupil' as unknown as UserType,
    })

    expect(result).toEqual([
      { text: 'cached', score: 1, source: 'x' },
    ])

    expect(mockedRedis.set).not.toHaveBeenCalled()
    expect(mockedQueryVectors).not.toHaveBeenCalled()
  })

  it('uses cached embedding and returns filtered results', async () => {
    // no retrieval cache
    mockedRedis.get
      .mockResolvedValueOnce(null) // retrieval cache
      .mockResolvedValueOnce(JSON.stringify([0.1, 0.2])) // embedding cache

    mockedQueryVectors.mockResolvedValue([
      {
        id: '1',
        score: 0.5,
        metadata: {
          chunk: 'good chunk',
          source: 'doc1',
          userType: 'pupil',
        },
      },
      {
        id: '2',
        score: 0.1, // below threshold
        metadata: {
          chunk: 'bad chunk',
          userType: 'pupil',
        },
      },
    ] satisfies ScoredPineconeRecord<ChunkMetadata>[])

    const result = await retrieveContext({
      question: 'Hello world',
      userType: 'pupil' as unknown as UserType,
    })

    expect(result).toEqual([
      {
        text: 'good chunk',
        score: 0.5,
        source: 'doc1',
      },
    ])

    expect(mockedQueryVectors).toHaveBeenCalled()
    expect(mockedRedis.set).toHaveBeenCalledTimes(1) // embedding + retrieval cache
  })

  it('creates embedding when cache miss and queries pinecone', async () => {
    mockedRedis.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    mockedQueryVectors.mockResolvedValue([
      {
        id: '1',
        score: 0.9,
        metadata: {
          chunk: 'chunk A',
          source: 'docA',
          userType: 'pupil',
        },
      },
    ] satisfies ScoredPineconeRecord<ChunkMetadata>[])

    const result = await retrieveContext({
      question: 'test',
      userType: 'pupil' as unknown as UserType,
    })

    expect(result).toEqual([
      {
        text: 'chunk A',
        score: 0.9,
        source: 'docA',
      },
    ])

    expect(mockedRedis.set).toHaveBeenCalled()
    expect(mockedQueryVectors).toHaveBeenCalled()
  })
})