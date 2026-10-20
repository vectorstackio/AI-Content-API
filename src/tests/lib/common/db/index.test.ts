import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  safeCreateMessage,
  getConversationHistory,
} from '@/lib/common/db'
import config from '@/lib/common/config'



beforeEach(() => {
  global.fetch = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})












describe('safeCreateMessage', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    global.fetch = mockFetch
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns success true when fetch succeeds', async () => {
    mockFetch.mockResolvedValue({ ok: true })

    const data = {
      userId: '1',
      role: 'assistant',
      content: 'hello',
      queryId: 'query-1',
    }

    const result = await safeCreateMessage(data)

    expect(mockFetch).toHaveBeenCalledTimes(1)

    expect(mockFetch).toHaveBeenCalledWith(
      `${config.app.apiUrl}/api/v02/db/hubAiMessages?tspAuthToken=${config.app.apiAuthToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    )

    expect(result).toEqual({
      success: true,
    })
  })

  it('returns error message when fetch throws Error', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'))

    const data = {
      userId: '1',
      role: 'assistant',
      content: 'hello',
      queryId: 'query-1',
    }

    const result = await safeCreateMessage(data)

    expect(result).toEqual({
      success: false,
      error: 'Network failure',
    })
  })

  it('returns Unknown error when non-Error is thrown', async () => {
    mockFetch.mockRejectedValue('something weird')

    const data = {
      userId: '1',
      role: 'assistant',
      content: 'hello',
      queryId: 'query-1',
    }

    const result = await safeCreateMessage(data)

    expect(result).toEqual({
      success: false,
      error: 'Unknown error',
    })
  })
})

describe('getConversationHistory', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    global.fetch = mockFetch
  })

  afterEach(() => {
    vi.clearAllMocks()
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
