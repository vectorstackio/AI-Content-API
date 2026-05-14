// lib/common/pinecone/__tests__/pinecone.test.js

import { upsertVectors, queryVectors, deleteVectors, deleteAll } from '@/lib/common/pinecone'
import { index } from '@/lib/common/pinecone/client'
import type { ChunkMetadata } from '@/types'

jest.mock('@/lib/common/pinecone/client', () => ({
  index: {
    upsert: jest.fn(),
    query: jest.fn(),
    deleteMany: jest.fn(),
  },
}))

const mockIndex = index as unknown as {
  upsert: jest.Mock
  query: jest.Mock
  deleteMany: jest.Mock
}

describe('upsertVectors', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls index.upsert with correct payload', async () => {
    const vectors: {
      id: string
      values: number[]
      metadata: ChunkMetadata
    }[] = [
      {
        id: '1',
        values: [0.1, 0.2],
        metadata: {
          chunk: 'hello',
          userType: 'pupil',
        },
      },
    ]

    await upsertVectors({ vectors })

    expect(mockIndex.upsert).toHaveBeenCalledWith({
      records: vectors,
    })
  })
})

describe('deleteVectors', () => {
  it('calls deleteMany with provided filters', async () => {
    const filters = {
      filter: {
        userType: { $eq: 'teacher' },
      },
    }

    await deleteVectors(filters)

    expect(mockIndex.deleteMany).toHaveBeenCalledWith(filters)
  })
})

describe('deleteAll', () => {
  it('deletes all vectors with url exists filter', async () => {
    await deleteAll()

    expect(mockIndex.deleteMany).toHaveBeenCalledWith({
      filter: {
        url: {
          $exists: true,
        },
      },
    })
  })
})

describe('queryVectors', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('queries without userType filter', async () => {
    mockIndex.query.mockResolvedValue({
      matches: [
        {
          score: 0.9,
          metadata: {
            chunk: 'valid chunk',
          },
        },
      ],
    })

    const result = await queryVectors({
      embedding: [1, 2, 3],
    })

    expect(mockIndex.query).toHaveBeenCalledWith({
      vector: [1, 2, 3],
      topK: 10,
      includeMetadata: true,
    })

    expect(result).toHaveLength(1)
  })

  it('adds userType filter when provided', async () => {
    mockIndex.query.mockResolvedValue({
      matches: [],
    })

    await queryVectors({
      embedding: [1, 2, 3],
      userType: 'pupil',
    })

    expect(mockIndex.query).toHaveBeenCalledWith({
      vector: [1, 2, 3],
      topK: 10,
      includeMetadata: true,
      filter: {
        userType: {
          $eq: 'pupil',
        },
      },
    })
  })

  it('handles undefined matches safely', async () => {
    mockIndex.query.mockResolvedValue({})

    const result = await queryVectors({
      embedding: [1, 2, 3],
    })

    expect(result).toEqual([])
  })

  it('filters out matches with missing metadata', async () => {
    mockIndex.query.mockResolvedValue({
      matches: [
        {
          score: 0.9,
          metadata: undefined,
        },
      ],
    })

    const result = await queryVectors({
      embedding: [1, 2, 3],
    })

    expect(result).toEqual([])
  })

  it('filters out matches with undefined score', async () => {
    mockIndex.query.mockResolvedValue({
      matches: [
        {
          metadata: {
            chunk: 'hello',
          },
        },
      ],
    })

    const result = await queryVectors({
      embedding: [1, 2, 3],
    })

    expect(result).toEqual([])
  })

  it('returns empty array when matches is undefined', async () => {
    mockIndex.query.mockResolvedValue({
      matches: undefined,
    })

    const result = await queryVectors({
      embedding: [1, 2, 3],
    })

    expect(result).toEqual([])
  })

  it('queries without userType filter', async () => {
    mockIndex.query.mockResolvedValue({
      matches: [],
    })

    await queryVectors({
      embedding: [1, 2, 3],
    })

    expect(mockIndex.query).toHaveBeenCalledWith({
      vector: [1, 2, 3],
      topK: 10,
      includeMetadata: true,
    })
  })

  it('queries with userType filter', async () => {
    mockIndex.query.mockResolvedValue({
      matches: [],
    })

    await queryVectors({
      embedding: [1, 2, 3],
      userType: 'pupil',
    })

    expect(mockIndex.query).toHaveBeenCalledWith({
      vector: [1, 2, 3],
      topK: 10,
      includeMetadata: true,
      filter: {
        userType: {
          $eq: 'pupil',
        },
      },
    })
  })
})