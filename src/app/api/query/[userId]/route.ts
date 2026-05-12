// app/api/query/[userId]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getConversationHistory, dbConnect } from '@/lib/common/db'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  try {
    await dbConnect()
    const { userId } = await params
    const messages = await getConversationHistory(userId)

    return NextResponse.json({
      success: true,
      data: messages,
    })
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
    