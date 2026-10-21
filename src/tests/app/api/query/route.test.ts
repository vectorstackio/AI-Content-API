import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST, GET, OPTIONS } from '@/app/api/query/route'
import { rateLimit } from '@/lib/common/rateLimit'
import { queryRagStream } from '@/lib/query'
import { dbConnect, safeCreateMessage } from '@/lib/common/db'

vi.mock('@/lib/common/db', () => ({ dbConnect: vi.fn(), safeCreateMessage: vi.fn() }))
vi.mock('@/lib/common/rateLimit', () => ({ rateLimit: vi.fn() }))
vi.mock('@/lib/query', () => ({ queryRagStream: vi.fn() }))

const valid = { question: 'Hello?', userType: 'pupil' }
function request(body: unknown = valid, ip: string | null = '203.0.113.1') {
  return new NextRequest('http://localhost/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(ip ? { 'x-forwarded-for': ip } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}
function result(stream: AsyncGenerator<string>, status: 'answered' | 'unknown' = 'answered') {
  return { stream, status, getFinal: async () => ({ answer: '', sources: [] }) }
}
beforeEach(() => {
  for (const mock of [dbConnect, safeCreateMessage, rateLimit, queryRagStream]) vi.mocked(mock).mockReset()
  vi.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 9 })
  vi.mocked(safeCreateMessage).mockResolvedValue({ success: true })
  vi.mocked(queryRagStream).mockResolvedValue(result((async function* () { yield 'Hello '; yield 'world' })()))
})

describe('POST /api/query', () => {
  it('streams publicly, preserves headers and persists both messages with one query ID', async () => {
    const response = await POST(request({ ...valid, question: ' Hello? ', userId: ' user-1 ' }))
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('Hello world')
    expect(queryRagStream).toHaveBeenCalledExactlyOnceWith({ ...valid, userId: 'user-1' }, { signal: expect.any(AbortSignal) })
    expect(rateLimit).toHaveBeenCalledExactlyOnceWith({ key: '203.0.113.1', limit: 10, windowSec: 60 })
    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
    expect(response.headers.get('X-AI-Status')).toBe('answered')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('9')
    expect(response.headers.get('Access-Control-Expose-Headers')).toBe('X-AI-Status')
    expect(response.headers.get('Cache-Control')).toBe('no-cache')
    const calls = vi.mocked(safeCreateMessage).mock.calls.map(([data]) => data)
    expect(calls).toEqual([
      { userId: 'user-1', role: 'user', content: 'Hello?', queryId: expect.any(String) },
      { userId: 'user-1', role: 'assistant', content: 'Hello world', queryId: calls[0].queryId },
    ])
    expect(calls[0].queryId).toMatch(/^[\da-f-]{36}$/)
  })

  it('uses anonymous fallback and supports unknown-context responses', async () => {
    vi.mocked(queryRagStream).mockResolvedValueOnce(result((async function* () { yield 'I don\'t know' })(), 'unknown'))
    const response = await POST(request(valid, null))
    expect(await response.text()).toBe('I don\'t know')
    expect(response.headers.get('X-AI-Status')).toBe('unknown')
    expect(rateLimit).toHaveBeenCalledWith({ key: 'anonymous', limit: 10, windowSec: 60 })
    expect(safeCreateMessage).toHaveBeenCalledWith(expect.objectContaining({ userId: 'anonymous' }))
  })

  it.each(['{', null, [], {}, { ...valid, question: ' ' }, { ...valid, question: 'x'.repeat(2001) }, { ...valid, userType: 'admin' }, { ...valid, userId: 123 }])('rejects invalid input %j before external services', async body => {
    const response = await POST(request(body))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ success: false, error: expect.any(String) })
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(dbConnect).not.toHaveBeenCalled()
    expect(rateLimit).not.toHaveBeenCalled()
    expect(queryRagStream).not.toHaveBeenCalled()
    expect(safeCreateMessage).not.toHaveBeenCalled()
  })

  it('returns 429 without retrieving or persisting content', async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce({ success: false, remaining: 0 })
    const response = await POST(request())
    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({ success: false, error: 'Too many requests. Please wait a moment.' })
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(queryRagStream).not.toHaveBeenCalled()
    expect(safeCreateMessage).not.toHaveBeenCalled()
  })

  it.each(['connection', 'rate limit', 'retrieval', 'unknown'] as const)('handles %s failure before streaming', async source => {
    const error = new Error(`${source} unavailable`)
    if (source === 'connection') vi.mocked(dbConnect).mockRejectedValueOnce(error)
    else if (source === 'rate limit') vi.mocked(rateLimit).mockRejectedValueOnce(error)
    else vi.mocked(queryRagStream).mockRejectedValueOnce(source === 'unknown' ? 'unexpected' : error)
    const response = await POST(request())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ success: false, error: source === 'unknown' ? 'Internal server error' : error.message })
    expect(safeCreateMessage).not.toHaveBeenCalled()
  })

  it.each([
    [false, 'OpenAI stream failed'],
    [true, 'OpenAI stream failed'],
    [true, 'OpenAI response incomplete'],
    [true, 'OpenAI stream ended before completion'],
  ] as const)('errors the response stream without saving an incomplete assistant answer (partial: %s, error: %s)', async (partial, message) => {
    vi.mocked(queryRagStream).mockResolvedValueOnce(result((async function* () {
      if (partial) yield 'partial answer'
      throw new Error(message)
    })()))
    const response = await POST(request())
    expect(response.status).toBe(200) // Headers are already committed.
    await expect(response.text()).rejects.toThrow(message)
    expect(safeCreateMessage).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ role: 'user' }))
  })

  it('continues streaming when best-effort message persistence reports failure', async () => {
    vi.mocked(safeCreateMessage).mockResolvedValue({ success: false, error: 'DB API unavailable' })
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('Hello world')
    expect(safeCreateMessage).toHaveBeenCalledTimes(2)
  })

  it('aborts a pending upstream read on response cancellation without saving an assistant answer', async () => {
    const closed = vi.fn()
    let upstreamSignal!: AbortSignal
    vi.mocked(queryRagStream).mockImplementationOnce(async (_input, { signal } = {}) => {
      upstreamSignal = signal!
      const pending = new Promise<never>((_resolve, reject) => {
        signal!.addEventListener('abort', () => reject(new Error('Upstream aborted')), { once: true })
      })
      async function* upstream() {
        try {
          yield 'partial'
          await pending
        } finally {
          closed()
        }
      }
      return result(upstream())
    })
    const response = await POST(request())
    const reader = response.body!.getReader()
    expect(new TextDecoder().decode((await reader.read()).value)).toBe('partial')
    await reader.cancel()
    expect(upstreamSignal.aborted).toBe(true)
    expect(closed).toHaveBeenCalledOnce()
    expect(safeCreateMessage).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ role: 'user' }))
  })

  it('forwards request aborts to pending upstream work and errors the body', async () => {
    const abort = new AbortController()
    const req = new NextRequest('http://localhost/api/query', { method: 'POST', body: JSON.stringify(valid), signal: abort.signal })
    let upstreamSignal!: AbortSignal
    vi.mocked(queryRagStream).mockImplementationOnce(async (_input, { signal } = {}) => {
      upstreamSignal = signal!
      const pending = new Promise<never>((_resolve, reject) => {
        signal!.addEventListener('abort', () => reject(new Error('Request aborted')), { once: true })
      })
      return result((async function* () { yield 'partial'; await pending })())
    })
    const response = await POST(req)
    const reader = response.body!.getReader()
    expect((await reader.read()).done).toBe(false)
    abort.abort()
    await expect(reader.read()).rejects.toThrow('Request aborted')
    expect(upstreamSignal.aborted).toBe(true)
    expect(safeCreateMessage).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ role: 'user' }))
  })

  it.each(['user', 'assistant'])('contains unexpected %s persistence rejections without failing a completed stream', async role => {
    vi.mocked(safeCreateMessage).mockImplementation(async message => {
      if (message.role === role) throw new Error('Unexpected persistence rejection')
      return { success: true }
    })
    const response = await POST(request())
    expect(await response.text()).toBe('Hello world')
    expect(safeCreateMessage).toHaveBeenCalledTimes(2)
  })

  it('contains iterator cleanup rejections on cancellation', async () => {
    async function* upstream() {
      try {
        yield 'partial'
      } finally {
        throw new Error('Iterator cleanup failed')
      }
    }
    // Keep the first read pending so cancellation itself exercises iterator.return.
    const iterator = upstream()
    const first = await iterator.next()
    expect(first.value).toBe('partial')
    const cleanup = vi.spyOn(iterator, 'return')
    let finish!: () => void
    vi.spyOn(iterator, 'next').mockReturnValue(new Promise(resolve => {
      finish = () => resolve({ done: true, value: undefined })
    }))
    vi.mocked(queryRagStream).mockResolvedValueOnce(result(iterator))
    const response = await POST(request())
    await expect(response.body!.cancel()).resolves.toBeUndefined()
    finish()
    expect(cleanup).toHaveBeenCalledOnce()
    expect(safeCreateMessage).toHaveBeenCalledTimes(1)
  })

})

describe('public query helpers', () => {
  it('serves static GET and preflight', async () => {
    expect(await (await GET()).json()).toEqual({ success: true, data: 'Query' })
    const response = await OPTIONS()
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
    expect(queryRagStream).not.toHaveBeenCalled()
  })
})
