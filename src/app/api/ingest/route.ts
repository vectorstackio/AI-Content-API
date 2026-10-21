// app/api/ingest/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { checkApiKey } from '@/lib/common/access'
import { ClientError } from '@/lib/common/error'
import { z } from 'zod'

import { ingestUrl } from '@/lib/ingest'

export const runtime = 'nodejs'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store',
}

export async function POST(req: NextRequest) {
  const accessError = checkApiKey(req)
  if (accessError) {
    return NextResponse.json(
      { success: false, error: accessError.error },
      { status: accessError.status, headers }
    )
  }

  try {
    const body = await req.json().catch(() => null)

    const url =
      typeof body?.url === 'string' && body.url.trim().length > 0
        ? body.url.trim()
        : null

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid URL' },
        { status: 400, headers }
      )
    }

    const audience = z.enum(['pupil', 'teacher', 'tutor']).safeParse(
      typeof body?.userType === 'string' ? body.userType.trim() : body?.userType
    )
    if (!audience.success) throw new ClientError('Missing or invalid userType')
    const userType = audience.data

    const result = await ingestUrl(url, userType)

    return NextResponse.json(
      {
        success: true,
        message: `URL ${url} successfully ingested`,
        ...result,
      },
      {
        headers
      }
    )
  } catch (err: unknown) {
    const getErrorResponse = (status: number, error: string) => {
      return NextResponse.json(
        {
          success: false,
          error,
        },
        {
          status,
          headers
        }
      )
    }

    const status = err instanceof ClientError ? 400 : 500
    const message = (err instanceof ClientError || err instanceof Error) ? err.message : 'Ingestion failed'
    return getErrorResponse(status, message)
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers,
  })
}

export async function GET() {
  return NextResponse.json({
    success: true,
    data: 'Ingest',
  })
}
