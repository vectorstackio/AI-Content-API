// app/api/query/[userId]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { checkApiKey } from '@/lib/common/access'
import { getConversationHistory, dbConnect } from '@/lib/common/db'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store',
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const accessError = checkApiKey(req)
  if (accessError) {
    return NextResponse.json(
      { success: false, error: accessError.error },
      { status: accessError.status, headers }
    )
  }

  try {
    await dbConnect()

    const { userId } = await context.params

    const messages = await getConversationHistory(userId)

    return NextResponse.json(
      {
        success: true,
        data: messages,
      },
      { headers }
    )
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500, headers }
    )
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers
  })
}
    