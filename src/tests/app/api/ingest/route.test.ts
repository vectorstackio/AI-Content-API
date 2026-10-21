// tests/app/api/ingest/route.test.ts

import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST, OPTIONS, GET } from '@/app/api/ingest/route'
import { ClientError } from '@/lib/common/error'
import { ingestUrl } from '@/lib/ingest'

vi.mock('@/lib/ingest', () => ({ ingestUrl: vi.fn() }))

afterEach(() => vi.unstubAllEnvs())
beforeEach(() => {
  vi.mocked(ingestUrl).mockReset()
  vi.stubEnv('INGEST_API_KEY', 'test-access-key')
  vi.mocked(ingestUrl).mockResolvedValue({ chunks: 2 })
})

function request(key?: string, body = JSON.stringify({ url: 'https://example.com', userType: 'pupil' })) {
  return new NextRequest('http://localhost/api/ingest', {
    method: 'POST', body,
    headers: { 'Content-Type': 'application/json', ...(key ? { 'x-api-key': key } : {}) },
  })
}

describe('POST /api/ingest access', () => {
  it('preserves the authorised success response', async () => {
    const response = await POST(request('test-access-key'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true, message: 'URL https://example.com successfully ingested', chunks: 2,
    })
    expect(ingestUrl).toHaveBeenCalledExactlyOnceWith('https://example.com', 'pupil')
  })

  it.each([undefined, 'wrong-key'])('rejects missing/incorrect key %s before parsing or ingestion', async key => {
    const response = await POST(request(key, 'invalid JSON'))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ success: false, error: 'Unauthorized' })
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(ingestUrl).not.toHaveBeenCalled()
  })

  it('fails closed when server configuration is missing', async () => {
    vi.stubEnv('INGEST_API_KEY', undefined)
    const response = await POST(request('test-access-key'))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ success: false, error: 'Protected endpoint unavailable' })
    expect(ingestUrl).not.toHaveBeenCalled()
  })

  it('keeps preflight public and advertises the header', async () => {
    const response = await OPTIONS()
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('X-API-Key')
    expect(ingestUrl).not.toHaveBeenCalled()
  })
})

// Invalid inputs must never reach scraping or Pinecone.
describe('POST /api/ingest validation and failures', () => {
  it.each(['{', 'null', '[]', '{}', '"text"', '{"url":42}', '{"url":"   "}'])('rejects invalid body %s', async body => {
    const response = await POST(request('test-access-key', body))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ success: false, error: 'Missing or invalid URL' })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(ingestUrl).not.toHaveBeenCalled()
  })

  it.each([undefined, null, '', ' ', 'admin', 1, [], {}])('rejects unsupported audience %j', async userType => {
    const response = await POST(request('test-access-key', JSON.stringify({ url: 'https://example.com', userType })))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ success: false, error: 'Missing or invalid userType' })
    expect(ingestUrl).not.toHaveBeenCalled()
  })

  it.each(['pupil', 'teacher', 'tutor'])('trims valid input for %s', async userType => {
    const response = await POST(request('test-access-key', JSON.stringify({ url: ' https://example.com ', userType: ` ${userType} ` })))
    expect(response.status).toBe(200)
    expect(ingestUrl).toHaveBeenCalledExactlyOnceWith('https://example.com', userType)
  })

  it('returns a client error for rejected URLs and preserves headers', async () => {
    vi.mocked(ingestUrl).mockRejectedValueOnce(new ClientError('URL is not allowed'))
    const response = await POST(request('test-access-key'))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ success: false, error: 'URL is not allowed' })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it.each([new Error('Embedding failed'), 'unexpected failure'])('returns 500 on ingestion failure %s', async error => {
    vi.mocked(ingestUrl).mockRejectedValueOnce(error)
    const response = await POST(request('test-access-key'))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ success: false, error: error instanceof Error ? error.message : 'Ingestion failed' })
  })

  it('keeps the static GET response public', async () => {
    expect(await (await GET()).json()).toEqual({ success: true, data: 'Ingest' })
    expect(ingestUrl).not.toHaveBeenCalled()
  })
})
