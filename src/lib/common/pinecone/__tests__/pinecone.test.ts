// lib/common/pinecone/__tests__/pinecone.test.js

import { upsertVectors/*, queryVectors, deleteVectors, deleteAll */ } from '@/lib/common/pinecone'
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