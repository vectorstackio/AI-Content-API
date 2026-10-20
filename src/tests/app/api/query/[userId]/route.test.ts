// tests/app/api/query/[userId]/route.test.ts

import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, OPTIONS } from '@/app/api/query/[userId]/route'
import { dbConnect, getConversationHistory } from '@/lib/common/db'

vi.mock('@/lib/common/db', () => ({ dbConnect: vi.fn(), getConversationHistory: vi.fn() }))
afterEach(() => vi.unstubAllEnvs())
beforeEach(() => vi.stubEnv('INGEST_API_KEY', 'test-access-key'))

function request(key?: string) {
  return new NextRequest('http://localhost/api/query/user-1', {
    headers: key ? { 'x-api-key': key } : {},
  })
}
const context = () => ({ params: Promise.resolve({ userId: 'user-1' }) })

describe('GET /api/query/[userId] access', () => {
  it('preserves authorised history and prevents caching', async () => {
    const messages = [{ userId: 'user-1', role: 'user', content: 'Hello', queryId: 'query-1' }]
    vi.mocked(getConversationHistory).mockResolvedValue(messages)
    const response = await GET(request('test-access-key'), context())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, data: messages })
    expect(getConversationHistory).toHaveBeenCalledExactlyOnceWith('user-1')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it.each([undefined, 'wrong-key'])('rejects missing/incorrect key %s before database access', async key => {
    const response = await GET(request(key), context())
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ success: false, error: 'Unauthorized' })
    expect(dbConnect).not.toHaveBeenCalled()
    expect(getConversationHistory).not.toHaveBeenCalled()
  })

  it('fails closed when server configuration is missing', async () => {
    vi.stubEnv('INGEST_API_KEY', undefined)
    const response = await GET(request('test-access-key'), context())
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ success: false, error: 'Protected endpoint unavailable' })
    expect(dbConnect).not.toHaveBeenCalled()
    expect(getConversationHistory).not.toHaveBeenCalled()
  })

  it('keeps preflight public and advertises the header', async () => {
    const response = await OPTIONS()
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('X-API-Key')
  })
})
