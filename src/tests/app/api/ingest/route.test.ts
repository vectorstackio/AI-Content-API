// tests/app/api/ingest/route.test.ts

import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST, OPTIONS } from '@/app/api/ingest/route'
import { ingestUrl } from '@/lib/ingest'

vi.mock('@/lib/ingest', () => ({ ingestUrl: vi.fn() }))

afterEach(() => vi.unstubAllEnvs())
beforeEach(() => {
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
