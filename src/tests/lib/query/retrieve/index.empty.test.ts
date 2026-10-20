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
  data: [ ]
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

  it('creates embedding when cache miss and throws if empty', async () => {
    mockedRedis.get
      .mockResolvedValueOnce(null) // retrieval cache
      .mockResolvedValueOnce(null) // embedding cache

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

    await expect(
      retrieveContext({
        question: 'fail case',
        userType: 'pupil' as unknown as UserType,
      })
    ).rejects.toThrow('Failed to create embedding')
    expect(mockedQueryVectors).not.toHaveBeenCalled()
    expect(mockedRedis.set).not.toHaveBeenCalled()
  })
})
