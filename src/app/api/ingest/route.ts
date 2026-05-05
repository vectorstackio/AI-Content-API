// app/api/ingest/route.ts

import { NextRequest, NextResponse } from 'next/server'

import { ingestUrl } from '@/lib/ingest'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)

    const url =
      typeof body?.url === 'string' && body.url.trim().length > 0
        ? body.url.trim()
        : null

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid URL' },
        { status: 400 }
      )
    }

    const result = await ingestUrl(url)

    return NextResponse.json({
      success: true,
      message: `URL ${url} successfully ingested`,
      ...result,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Ingestion failed',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    data: 'Ingest',
  })
}