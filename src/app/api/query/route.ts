// app/api/query/route.ts

import crypto from 'crypto'

import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { querySchema } from '@/lib/query/validators'
import { queryRagStream } from '@/lib/query'
import { rateLimit } from '@/lib/common/rateLimit'
import { dbConnect, safeCreateMessage } from '@/lib/common/db'
//import { deleteAll } from '@/lib/common/pinecone'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Expose-Headers': 'X-AI-Status', // 👈 REQUIRED
  'Access-Control-Max-Age': '86400',
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect()

    const body = await req.json()
    const validated = querySchema.parse(body)
    const { userId } = validated
    const queryId = crypto.randomUUID()

    const ip = req.headers.get('x-forwarded-for') ?? 'anonymous'

    const { success, remaining } = await rateLimit({
      key: ip,
      limit: 10,
      windowSec: 60,
    })

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests. Please wait a moment.',
        },
        { status: 429 }
      )
    }

    const encoder = new TextEncoder()

    const { stream, status } = await queryRagStream(validated)

    // 🟢 save user message
    await safeCreateMessage({
      userId: userId ?? ip,
      role: 'user',
      content: validated.question,
      queryId: queryId,
    })

    let fullAnswer = ''

    const streamResponse = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            fullAnswer += chunk
            controller.enqueue(encoder.encode(chunk))
          }

          controller.close()

          // 🟢 save assistant message AFTER stream ends
          await safeCreateMessage({
            userId: userId ?? ip,
            role: 'assistant',
            content: fullAnswer,
            queryId: queryId,
          })

        } catch (err) {
          controller.error(err)

          // optional: still persist partial answer
          if (fullAnswer) {
            await safeCreateMessage({
              userId: userId ?? ip,
              role: 'assistant',
              content: fullAnswer,
              queryId: queryId,
            })
          }
        }
      },
    })

    return new Response(streamResponse, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-RateLimit-Remaining': String(remaining),
        'X-AI-Status': status,
        ...headers,
      },
    })

  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: err.issues[0]?.message ?? 'Invalid request',
        },
        { status: 400, headers }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500, headers }
    )
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

export async function GET() {
  return NextResponse.json({
    success: true,
    data: 'Query',
  })
}