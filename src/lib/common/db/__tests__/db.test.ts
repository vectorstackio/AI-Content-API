// lib/common/db/__tests__/db.test.ts

import {
  safeCreateMessage,
  getConversationHistory,
} from '@/lib/common/db'

import HubAiMessages from '@/lib/common/db/models/hubAiMessage.model'

const mockModel = HubAiMessages as unknown as {
  create: jest.Mock
  find: jest.Mock
}

describe('safeCreateMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns success true when message is created', async () => {
    mockModel.create.mockResolvedValue({})

    const result = await safeCreateMessage({
      userId: 'user-1',
      role: 'user',
      content: 'hello',
      queryId: 'query-1',
    })

    expect(mockModel.create).toHaveBeenCalledWith({
      userId: 'user-1',
      role: 'user',
      content: 'hello',
      queryId: 'query-1',
    })

    expect(result).toEqual({
      success: true,
    })
  })

  it('returns error message when Error is thrown', async () => {
    mockModel.create.mockRejectedValue(
      new Error('Database failed')
    )

    const result = await safeCreateMessage({
      userId: 'user-1',
      role: 'user',
      content: 'hello',
      queryId: 'query-1',
    })

    expect(result).toEqual({
      success: false,
      error: 'Database failed',
    })
  })

  it('returns unknown error when non-Error is thrown', async () => {
    mockModel.create.mockRejectedValue('boom')

    const result = await safeCreateMessage({
      userId: 'user-1',
      role: 'user',
      content: 'hello',
      queryId: 'query-1',
    })

    expect(result).toEqual({
      success: false,
      error: 'Unknown error',
    })
  })
})

describe('getConversationHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns conversation history with explicit limit', async () => {
    const mockLimit = jest.fn().mockResolvedValue([
      {
        content: 'hello',
      },
    ])

    const mockSort = jest.fn(() => ({
      limit: mockLimit,
    }))

    mockModel.find.mockReturnValue({
      sort: mockSort,
    })

    const result = await getConversationHistory(
      'user-1',
      10
    )

    expect(mockModel.find).toHaveBeenCalledWith({
      userId: 'user-1',
    })

    expect(mockSort).toHaveBeenCalledWith({
      createdAt: 1,
    })

    expect(mockLimit).toHaveBeenCalledWith(10)

    expect(result).toEqual([
      {
        content: 'hello',
      },
    ])
  })

  it('uses default limit of 20', async () => {
    const mockLimit = jest.fn().mockResolvedValue([])

    const mockSort = jest.fn(() => ({
      limit: mockLimit,
    }))

    mockModel.find.mockReturnValue({
      sort: mockSort,
    })

    await getConversationHistory('user-1')

    expect(mockLimit).toHaveBeenCalledWith(20)
  })
})