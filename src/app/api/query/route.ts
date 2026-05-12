// app/api/query/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { querySchema } from '@/lib/query/validators'
import { queryRagStream } from '@/lib/query'
import { rateLimit } from '@/lib/common/rateLimit'
//import { deleteAll } from '@/lib/pinecone'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate request
    const validated = querySchema.parse(body)

    // 👇 identify user (simple IP-based)
    const ip =
      req.headers.get('x-forwarded-for') ??
      'anonymous'

    // 👇 rate limit config
    const { success, remaining } = await rateLimit({
      key: ip,
      limit: 10,        // 10 requests
      windowSec: 60,    // per minute
    })

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests. Please wait a moment.',
        },
        {
          status: 429,
        }
      )
    }

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // STREAMING RAG PIPELINE
          const ragStream = await queryRagStream(validated)

          for await (const chunk of ragStream) {
            // chunk should be a string (token or partial text)
            controller.enqueue(encoder.encode(chunk))
          }

          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    // Uncommenting this will delete all data from the Pinecone index
    // await deleteAll()

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-RateLimit-Remaining': String(remaining),
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
        {
          status: 400,
          headers
        }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : 'Internal server error',
      },
      {
        status: 500,
        headers
      }
    )
  }
}

// export async function POST(req: NextRequest) {
//   try {
//     const body = await req.json()

//     // Validate request
//     const validated = querySchema.parse(body)

//     // Run RAG pipeline
//     const result = await queryRag(validated)

//     // Uncommenting this will delete all data from the Pinecone index
//     //await deleteAll()

//     return NextResponse.json(
//       result,
//       {
//         headers
//       }
//     )
//   } catch (err: unknown) {
//     //console.error('Query API error:', err)

//     if (err instanceof ZodError) {
//       return NextResponse.json(
//         {
//           success: false,
//           error: err.issues[0]?.message ?? 'Invalid request',
//         },
//         {
//           status: 400,
//           headers
//         }
//       )
//     }

//     return NextResponse.json(
//       {
//         success: false,
//         error:
//           err instanceof Error
//             ? err.message
//             : 'Internal server error',
//       },
//       {
//         status: 500,
//         headers
//       }
//     )
//   }
// }

// import OpenAI from 'openai'
// import { Pinecone } from '@pinecone-database/pinecone'

// import { NextRequest, NextResponse } from 'next/server'

// import config from '@/lib/config'
// import * as constants from '@/lib/constants'
// //import { deleteAll } from '@/lib/pinecone'

// const openai = new OpenAI({
//   apiKey: config.app.openAiKey,
// })

// const pinecone = new Pinecone({
//   apiKey: config.app.pineconeApiKey,
// })

// const index = pinecone.index(config.app.pineconeIndexName)

// type QueryResponse =
//   | { success: true; answer: string; context: string[] }
//   | { success: false; error: string }

// export async function POST(req: NextRequest): Promise<NextResponse<QueryResponse>> {
//   try {
//     const body = await req.json().catch(() => null)

//     const question =
//       typeof body?.question === 'string' && body.question.trim().length > 0
//         ? body.question
//         : null

//     if (!question) {
//       return NextResponse.json(
//         { success: false, error: 'Question is required' },
//         { status: 400 }
//       )
//     }

//     const userType =
//       body?.userType === 'pupil' ||
//         body?.userType === 'teacher' ||
//         body?.userType === 'tutor'
//         ? body.userType
//         : null

//     if (!userType) {
//       return NextResponse.json(
//         { success: false, error: 'userType is required' },
//         { status: 400 }
//       )
//     }

//     // 1. Embed the question
//     const queryEmbedding = await openai.embeddings.create({
//       model: constants.EMBEDDING_MODEL,
//       input: question,
//     })
//     const embedding = queryEmbedding.data[0].embedding
//     if (!embedding) {
//       return NextResponse.json(
//         { success: false, error: 'Failed to create embedding' },
//         { status: 500 }
//       )
//     }

//     // 2. Query Pinecone
//     const searchRes = await index.query({
//       vector: queryEmbedding.data[0].embedding,
//       topK: 3,
//       includeMetadata: true,
//       filter: {
//         userType: { $eq: userType },
//       },
//     })

//     const contextTexts = searchRes.matches?.map((m) => String(m.metadata?.chunk || '')) ?? []
//     if (!contextTexts.length || !contextTexts.some(Boolean)) {
//       return NextResponse.json({
//         success: true,
//         answer: 'I don\'t know',
//         context: [],
//       })
//     }

//     const context = contextTexts.join('\n')

//     // 3. Ask OpenAI with context
//     const completion = await openai.responses.create({
//       model: constants.CHAT_MODEL,
//       input: `
// You are a helpful assistant. Answer the question using ONLY the context below.
// If the answer is not in the context, say 'I don't know'.

// Context:
// ${context}

// Question:
// ${question}
//       `
//     })

//     const answer = completion.output_text

//     if (!answer) {
//       return NextResponse.json(
//         { success: false, error: 'No answer returned' },
//         { status: 502 }
//       )
//     }

//     //await deleteAll()

//     return NextResponse.json({
//       success: true,
//       answer,
//       context: contextTexts,
//     })
//   } catch(err) {
//     //console.error('Query error:', err)

//     return NextResponse.json(
//       {
//         success: false,
//         error: err instanceof Error ? err.message : 'Unknown error',
//       },
//       { status: 500 }
//     )
//   }

// }

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