// tests/app/api/query/route.test.ts

import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/query/route'
import { rateLimit } from '@/lib/common/rateLimit'
import { queryRagStream } from '@/lib/query'

vi.mock('@/lib/common/db', () => ({ dbConnect: vi.fn(), safeCreateMessage: vi.fn() }))
vi.mock('@/lib/common/rateLimit', () => ({ rateLimit: vi.fn() }))
vi.mock('@/lib/query', () => ({ queryRagStream: vi.fn() }))

afterEach(() => vi.unstubAllEnvs())
beforeEach(() => {
  vi.stubEnv('INGEST_API_KEY', undefined)
})

function request() {
  return new NextRequest('http://localhost/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.1' },
    body: JSON.stringify({ question: 'Hello?', userType: 'pupil' }),
  })
}

describe('public query access', () => {
  it('streams without an API key or protected-endpoint configuration', async () => {
    vi.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 9 })
    vi.mocked(queryRagStream).mockResolvedValue({
      stream: (async function* () { yield 'Hello' })(),
      status: 'answered',
      getFinal: async () => ({ answer: 'Hello', sources: [] }),
    })
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('Hello')
    expect(rateLimit).toHaveBeenCalledExactlyOnceWith({ key: '203.0.113.1', limit: 10, windowSec: 60 })
  })

  it('still rate limits public callers', async () => {
    vi.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0 })
    const response = await POST(request())
    expect(response.status).toBe(429)
    expect((await response.json()).success).toBe(false)
    expect(queryRagStream).not.toHaveBeenCalled()
  })
})
