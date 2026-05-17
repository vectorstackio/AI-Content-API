// lib/query/retrieve/__tests__/retrieve.empty.test.ts

import { retrieveContext } from '@/lib/query/retrieve'
import { redis } from '@/lib/common/redis'
import { queryVectors } from '@/lib/common/pinecone'
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
  data: [ ]
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
  })
})