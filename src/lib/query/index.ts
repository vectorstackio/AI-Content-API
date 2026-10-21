// lib/query/index.ts

import OpenAI from 'openai'

import config from '@/lib/common/config'
import * as constants from '@/lib/common/constants'

import { retrieveContext } from './retrieve'
import { buildPrompt } from './prompt'

const openai = new OpenAI({
  apiKey: config.app.openAiKey,
})

type QueryRagParams = {
  question: string
  userType: 'pupil' | 'teacher' | 'tutor'
  userId?: string
}

export type QuerySuccessResponse = {
  success: true
  answer: string

  sources: {
    text: string
    score: number
    source?: string
  }[]
}

export type QueryErrorResponse = {
  success: false
  error: string
}

export type QueryResponse =
  | QuerySuccessResponse
  | QueryErrorResponse

export async function queryRagStream({
  question,
  userType,
}: QueryRagParams, { signal }: { signal?: AbortSignal } = {}) {

  signal?.throwIfAborted()

  const chunks = await retrieveContext({
    question,
    userType,
  })
  signal?.throwIfAborted()

  // 🟡 NO CONTEXT → unknown status
  if (!chunks.length) {
    async function* emptyStream() {
      signal?.throwIfAborted()
      yield 'I don\'t know'
    }

    return {
      stream: emptyStream(),
      status: 'unknown' as const,
      getFinal: async () => ({
        answer: 'I don\'t know',
        sources: [],
      }),
    }
  }

  const prompt = buildPrompt({
    question,
    contextChunks: chunks.map((c) => c.text),
  })

  const response =
    await openai.responses.create({
      model: constants.CHAT_MODEL,
      input: prompt,
      stream: true,
    }, { signal })

  let fullAnswer = ''

  async function* stream() {
    let completed = false
    for await (const event of response) {
      signal?.throwIfAborted()
      if (event.type === 'error') throw new Error(event.message)
      if (event.type === 'response.failed') throw new Error(event.response.error?.message ?? 'OpenAI response failed')
      if (event.type === 'response.incomplete') throw new Error('OpenAI response incomplete')
      if (event.type === 'response.completed') completed = true
      if (event.type === 'response.output_text.delta') {
        fullAnswer += event.delta
        yield event.delta
      }
    }
    signal?.throwIfAborted()
    if (!completed) throw new Error('OpenAI stream ended before completion')
  }

  return {
    stream: stream(),
    status: 'answered' as const,
    getFinal: async () => ({
      answer: fullAnswer.trim(),
      sources: chunks.map((c) => ({
        text: c.text,
        score: c.score,
        source: c.source,
      })),
    }),
  }
}

// export async function queryRag({
//   question,
//   userType,
// }: QueryRagParams): Promise<QueryResponse> {
//   // Retrieve relevant chunks
//   const chunks = await retrieveContext({
//     question,
//     userType,
//   })

//   // No useful matches
//   if (!chunks.length) {
//     return {
//       success: true,
//       answer: 'I don\'t know',
//       sources: [],
//     }
//   }

//   // Build prompt
//   const prompt = buildPrompt({
//     question,
//     contextChunks: chunks.map((chunk) => chunk.text),
//   })

//   // Call OpenAI
//   const completion = await openai.responses.create({
//     model: constants.CHAT_MODEL,
//     input: prompt,
//   })

//   const answer = completion.output_text?.trim()

//   if (!answer) {
//     throw new Error('No answer returned from OpenAI')
//   }

//   return {
//     success: true,
//     answer,

//     sources: chunks.map((chunk) => ({
//       text: chunk.text,
//       score: chunk.score,
//       source: chunk.source,
//     })),
//   }
// }
