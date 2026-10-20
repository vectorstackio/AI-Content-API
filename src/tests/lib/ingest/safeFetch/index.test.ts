import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchHtml, FETCH_LIMITS } from '@/lib/ingest/safeFetch'
import { ClientError } from '@/lib/common/error'

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }))
vi.mock('node:dns/promises', () => ({ lookup: mocks.lookup }))
vi.mock('node:http', () => ({ request: mocks.request }))
vi.mock('node:https', () => ({ request: mocks.request }))

function responseFixture(status = 200, headers: Record<string, string> = { 'content-type': 'text/html' }, body = '<article>OK</article>') {
  mocks.request.mockImplementation((_url, _options, callback) => {
    const req = Object.assign(new EventEmitter(), {
      end: vi.fn(() => queueMicrotask(() => {
        const response = Object.assign(new EventEmitter(), { statusCode: status, headers, destroy: vi.fn() })
        callback(response)
        response.emit('data', Buffer.from(body))
        response.emit('end')
        req.emit('close')
      })),
      destroy: vi.fn((error?: Error) => {
        if (error) req.emit('error', error)
        req.emit('close')
      }),
      setTimeout: vi.fn(),
    })
    return req
  })
}

beforeEach(() => {
  mocks.lookup.mockReset().mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
  mocks.request.mockReset()
  responseFixture()
})

describe('fetchHtml', () => {
  it.each(['http://example.com', 'https://example.com', 'https://8.8.8.8', 'https://[2606:4700:4700::1111]'])('fetches public URL %s', async url => {
    await expect(fetchHtml(url)).resolves.toContain('<article>')
    expect(mocks.request).toHaveBeenCalledOnce()
    expect(mocks.request.mock.calls[0][1]).toMatchObject({ agent: false })
  })

  it.each([
    ['not a URL', 'Invalid URL'], ['file:///etc/passwd', 'Only HTTP'],
    ['ftp://example.com', 'Only HTTP'], ['data:text/html,hello', 'Only HTTP'],
    ['https://user:secret@example.com', 'credentials'], ['https://user@example.com', 'credentials'],
    ['http://localhost', 'not public'], ['http://foo.localhost.', 'not public'],
    ['http://test.local', 'not public'], ['http://127.1', 'not public'],
    ['http://2130706433', 'not public'], ['http://0x7f000001', 'not public'],
    ['http://10.0.0.1', 'not public'], ['http://169.254.169.254', 'not public'],
    ['http://[::1]', 'not public'], ['http://[fd00::1]', 'not public'],
    ['http://[::ffff:127.0.0.1]', 'not public'],
  ])('rejects %s before HTTP', async (url, message) => {
    await expect(fetchHtml(url)).rejects.toThrow(message)
    expect(mocks.request).not.toHaveBeenCalled()
  })

  it.each([
    [], [{ address: '10.0.0.1', family: 4 }],
    [{ address: '93.184.216.34', family: 4 }, { address: '192.168.1.1', family: 4 }],
    [{ address: '93.184.216.34', family: 4 }, { address: '::1', family: 6 }],
  ].map(addresses => ({ addresses })))('rejects an empty or unsafe DNS snapshot %#', async ({ addresses }) => {
    mocks.lookup.mockResolvedValue(addresses)
    await expect(fetchHtml('https://example.com')).rejects.toThrow('not public')
    expect(mocks.request).not.toHaveBeenCalled()
  })

  it('pins both lookup callback forms to the validated address', async () => {
    await fetchHtml('https://example.com')
    const lookup = mocks.request.mock.calls[0][1].lookup
    const callback = vi.fn()
    lookup('example.com', {}, callback)
    expect(callback).toHaveBeenLastCalledWith(null, '93.184.216.34', 4)
    lookup('example.com', { all: true }, callback)
    expect(callback).toHaveBeenLastCalledWith(null, [{ address: '93.184.216.34', family: 4 }])
    expect(mocks.lookup).toHaveBeenCalledExactlyOnceWith('example.com', { all: true, verbatim: true })
  })

  it('rejects redirects without requesting their internal Location', async () => {
    responseFixture(302, { 'content-type': 'text/html', location: 'http://169.254.169.254' })
    await expect(fetchHtml('https://example.com')).rejects.toThrow('redirects')
    expect(mocks.request).toHaveBeenCalledOnce()
  })

  it.each(['application/json', 'text/plain', 'image/png', ''])('rejects content type %s', async type => {
    responseFixture(200, { 'content-type': type })
    await expect(fetchHtml('https://example.com')).rejects.toThrow('HTML')
  })

  it('accepts XHTML with content type parameters', async () => {
    responseFixture(200, { 'content-type': 'application/xhtml+xml; charset=utf-8' })
    await expect(fetchHtml('https://example.com')).resolves.toContain('OK')
  })

  it('rejects compressed responses', async () => {
    responseFixture(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' })
    await expect(fetchHtml('https://example.com')).rejects.toThrow('Compressed')
  })

  it('checks advertised response length', async () => {
    responseFixture(200, { 'content-type': 'text/html', 'content-length': String(FETCH_LIMITS.responseBytes + 1) })
    await expect(fetchHtml('https://example.com')).rejects.toThrow('too large')
  })

  it('enforces actual response length without Content-Length', async () => {
    responseFixture(200, { 'content-type': 'text/html' }, 'a'.repeat(FETCH_LIMITS.responseBytes + 1))
    await expect(fetchHtml('https://example.com')).rejects.toThrow('too large')
  })

  it('sanitises DNS and transport failures', async () => {
    mocks.lookup.mockRejectedValue(new Error('sensitive internal details'))
    await expect(fetchHtml('https://example.com')).rejects.toThrow(new ClientError('Unable to fetch URL'))
    mocks.lookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }])
    mocks.request.mockImplementation(() => { throw new Error('internal transport details') })
    await expect(fetchHtml('https://example.com')).rejects.toThrow('Unable to fetch URL')
  })

  it('rejects unsuccessful responses', async () => {
    responseFixture(500)
    await expect(fetchHtml('https://example.com')).rejects.toThrow('unsuccessful')
  })

  it('bounds DNS resolution with the overall timeout and never starts a late request', async () => {
    vi.useFakeTimers()
    try {
      const deferred = Promise.withResolvers<{ address: string, family: number }[]>()
      mocks.lookup.mockReturnValue(deferred.promise)
      const result = expect(fetchHtml('https://example.com')).rejects.toThrow('timed out')
      await vi.advanceTimersByTimeAsync(FETCH_LIMITS.overallMs)
      await result
      deferred.resolve([{ address: '8.8.8.8', family: 4 }])
      await Promise.resolve()
      expect(mocks.request).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('times out a connection that never opens', async () => {
    vi.useFakeTimers()
    try {
      responseFixture()
      const normal = mocks.request.getMockImplementation()!
      mocks.request.mockImplementation((...args) => {
        const req = normal(...args)
        req.end.mockImplementation(() => {})
        return req
      })
      const result = expect(fetchHtml('https://example.com')).rejects.toThrow('timed out')
      await vi.advanceTimersByTimeAsync(FETCH_LIMITS.connectionMs)
      await result
    } finally {
      vi.useRealTimers()
    }
  })

  it('bounds the whole response even after the connection opens', async () => {
    vi.useFakeTimers()
    try {
      mocks.request.mockImplementation(() => {
        const req = Object.assign(new EventEmitter(), {
          end: vi.fn(() => queueMicrotask(() => {
            const socket = new EventEmitter()
            req.emit('socket', socket)
            socket.emit('connect')
          })),
          destroy: vi.fn(),
          setTimeout: vi.fn(),
        })
        return req
      })
      const result = expect(fetchHtml('http://example.com')).rejects.toThrow('timed out')
      await vi.advanceTimersByTimeAsync(FETCH_LIMITS.overallMs)
      await result
    } finally {
      vi.useRealTimers()
    }
  })

})
