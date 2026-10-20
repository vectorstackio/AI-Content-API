import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { MockedFunction, Mocked } from 'vitest'

import { retrieveContext } from '@/lib/query/retrieve'
import { redis } from '@/lib/common/redis'
import { queryVectors } from '@/lib/common/pinecone'
import type { ScoredPineconeRecord } from '@pinecone-database/pinecone'
import type { ChunkMetadata, UserType } from '@/types'

vi.mock('@/lib/common/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
  },
}))

vi.mock('@/lib/common/pinecone', () => ({
  queryVectors: vi.fn(),
}))

const response = vi.hoisted(() => ({
  data: [
    { embedding: [0.1, 0.2] },
    { embedding: [0.3, 0.4] },
  ],
}))

vi.mock('openai', () => ({
  default: class {
    embeddings = { create: vi.fn(async () => response) }
  },
}))

const mockedRedis = redis as Mocked<typeof redis>
const mockedQueryVectors = queryVectors as MockedFunction<
  typeof queryVectors
>

describe('retrieveContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

    expect(mockedQueryVectors).toHaveBeenCalledWith({
      embedding: [0.1, 0.2],
      userType: 'pupil',
    })
    expect(mockedRedis.set).toHaveBeenCalledTimes(1) // retrieval cache only
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

    expect(mockedRedis.set).toHaveBeenCalledTimes(2)
    expect(mockedRedis.set).toHaveBeenCalledWith(
      'embedding:text-embedding-3-small:test', JSON.stringify([0.1, 0.2]), 'EX', 604800
    )
    expect(mockedRedis.set).toHaveBeenCalledWith(
      'retrieval:v1:pupil:test', JSON.stringify(result), 'EX', 3600
    )
    expect(mockedQueryVectors).toHaveBeenCalledWith({
      embedding: [0.1, 0.2],
      userType: 'pupil',
    })
  })
})
