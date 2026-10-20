// lib/common/access/index.ts

import 'server-only'
import { timingSafeEqual } from 'node:crypto'

/** Shared prototype access key; read at request time, never included in responses. */
export function checkApiKey(request: Request): { status: number, error: string } | null {
  const expected = process.env.INGEST_API_KEY
  if (!expected?.trim()) return { status: 503, error: 'Protected endpoint unavailable' }

  const supplied = request.headers.get('x-api-key')
  if (!supplied) return { status: 401, error: 'Unauthorized' }

  const expectedBytes = Buffer.from(expected)
  const suppliedBytes = Buffer.from(supplied)
  if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
    return { status: 401, error: 'Unauthorized' }
  }
  return null
}
