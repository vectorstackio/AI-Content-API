// tests/lib/common/access/index.test.ts

import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkApiKey } from '@/lib/common/access'

afterEach(() => vi.unstubAllEnvs())

describe('checkApiKey', () => {
  it('accepts the configured header key', () => {
    vi.stubEnv('INGEST_API_KEY', 'test-access-key')
    expect(checkApiKey(new Request('http://localhost', {
      headers: { 'X-API-Key': 'test-access-key' },
    }))).toBeNull()
  })

  it.each([undefined, '', 'wrong', 'test-access-kez', 'test-access-key-longer'])('rejects invalid header %s', key => {
    vi.stubEnv('INGEST_API_KEY', 'test-access-key')
    const request = new Request('http://localhost', { headers: key === undefined ? {} : { 'x-api-key': key } })
    expect(checkApiKey(request)).toEqual({ status: 401, error: 'Unauthorized' })
  })

  it.each([undefined, '', '   '])('fails closed for missing configuration %s', key => {
    vi.stubEnv('INGEST_API_KEY', key)
    const request = new Request('http://localhost', { headers: { 'x-api-key': 'test-access-key' } })
    expect(checkApiKey(request)).toEqual({ status: 503, error: 'Protected endpoint unavailable' })
  })

  it('does not accept a key in the URL or Authorization header', () => {
    vi.stubEnv('INGEST_API_KEY', 'test-access-key')
    const request = new Request('http://localhost?x-api-key=test-access-key', {
      headers: { Authorization: 'test-access-key' },
    })
    expect(checkApiKey(request)?.status).toBe(401)
  })
})
