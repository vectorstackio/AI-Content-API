import { beforeEach, describe, expect, it, vi } from 'vitest'
import { safeCreateMessage, getConversationHistory } from '@/lib/common/db'
import config from '@/lib/common/config'

const fetchMock = vi.fn()
const message = { userId: 'user-1', role: 'assistant', content: 'hello', queryId: 'query-1' }
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

describe('safeCreateMessage', () => {
  it('POSTs message JSON and reports success for a successful HTTP response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true })
    await expect(safeCreateMessage(message)).resolves.toEqual({ success: true })
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      `${config.app.apiUrl}/api/v02/db/hubAiMessages?tspAuthToken=${config.app.apiAuthToken}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(message) }
    )
  })

  it('reports HTTP errors as a failed best-effort write', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 })
    await expect(safeCreateMessage(message)).resolves.toEqual({ success: false, error: 'Message persistence failed (503)' })
  })

  it.each([new Error('Network failure'), 'unexpected'])('contains network failure %s', async error => {
    fetchMock.mockRejectedValueOnce(error)
    await expect(safeCreateMessage(message)).resolves.toEqual({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
  })
})

describe('getConversationHistory', () => {
  it('requests the chosen user and limit and returns records', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ records: [message] }) })
    await expect(getConversationHistory('user-1', 10)).resolves.toEqual([message])
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      `${config.app.apiUrl}/api/v02/db/hubAiMessages?userId=user-1&limit=10&tspAuthToken=${config.app.apiAuthToken}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    )
  })

  it('encodes IDs so user input cannot inject upstream DB query parameters', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ records: [] }) })
    const userId = 'alice&limit=999&userId=bob#fragment'
    await expect(getConversationHistory(userId)).resolves.toEqual([])
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.searchParams.getAll('userId')).toEqual([userId])
    expect(url.searchParams.getAll('limit')).toEqual(['20'])
  })

  it('returns empty history for absent records', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await expect(getConversationHistory('user-1')).resolves.toEqual([])
  })

  it('rejects non-array records', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ records: {} }) })
    await expect(getConversationHistory('user-1')).rejects.toThrow('Invalid conversation history response')
  })

  it('rejects HTTP errors even when the body resembles an empty successful result', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
    await expect(getConversationHistory('user-1')).rejects.toThrow('Conversation history request failed (401)')
  })

  it('propagates network and invalid JSON failures', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Connection refused'))
    await expect(getConversationHistory('user-1')).rejects.toThrow('Connection refused')
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => { throw new SyntaxError('Invalid JSON') } })
    await expect(getConversationHistory('user-1')).rejects.toThrow('Invalid JSON')
  })
})
