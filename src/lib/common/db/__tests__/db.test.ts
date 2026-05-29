// lib/common/db/__tests__/db.test.ts

import {
  safeCreateMessage,
  getConversationHistory,
} from '@/lib/common/db'
import config from '@/lib/common/config'

import HubAiMessages from '@/lib/common/db/models/hubAiMessage.model'

const mockModel = HubAiMessages as unknown as {
  create: jest.Mock
  find: jest.Mock
}

beforeEach(() => {
  global.fetch = jest.fn()
})

afterEach(() => {
  jest.restoreAllMocks()
})

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
  const mockFetch = jest.fn()

  beforeEach(() => {
    global.fetch = mockFetch
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('returns messages from api response', async () => {
    const mockMessages = [
      {
        id: '1',
        message: 'hello',
      },
      {
        id: '2',
        message: 'world',
      },
    ]

    mockFetch.mockResolvedValue({
      json: async () => ({
        records: mockMessages,
      }),
    })

    const result = await getConversationHistory('user-123', 10)

    expect(mockFetch).toHaveBeenCalledTimes(1)

    expect(mockFetch).toHaveBeenCalledWith(
      `${config.app.apiUrl}/api/v02/db/hubAiMessages?userId=user-123&limit=10&tspAuthToken=${config.app.apiAuthToken}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    expect(result).toEqual(mockMessages)
  })

  it('uses default limit when not supplied', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({
        records: [],
      }),
    })

    await getConversationHistory('user-456')

    expect(mockFetch).toHaveBeenCalledWith(
      `${config.app.apiUrl}/api/v02/db/hubAiMessages?userId=user-456&limit=20&tspAuthToken=${config.app.apiAuthToken}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  })

  it('returns empty array when records is undefined', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({}),
    })

    const result = await getConversationHistory('user-789')

    expect(result).toEqual([])
  })
})