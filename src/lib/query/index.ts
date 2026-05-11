// lib/query/index.ts

import OpenAI from 'openai'
import type { ResponseStreamEvent } from 'openai/resources/responses/responses'

import config from '@/lib/config'
import * as constants from '@/lib/constants'

import { retrieveContext } from './retrieve'
import { buildPrompt } from './prompt'

const openai = new OpenAI({
  apiKey: config.app.openAiKey,
})

type QueryRagParams = {
  question: string
  userType: 'pupil' | 'teacher' | 'tutor'
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
}: QueryRagParams) {
  // 1. Retrieve context (same as before)
  const chunks = await retrieveContext({
    question,
    userType,
  })

  // 2. Handle empty context
  if (!chunks.length) {
    async function* emptyStream() {
      yield 'I don\'t know'
    }
    return emptyStream()
  }

  // 3. Build prompt (unchanged)
  const prompt = buildPrompt({
    question,
    contextChunks: chunks.map((chunk) => chunk.text),
  })

  // 4. Call OpenAI with STREAMING enabled
  const response: AsyncIterable<ResponseStreamEvent> = await openai.responses.create({
    model: constants.CHAT_MODEL,
    input: prompt,
    stream: true,
  })

  // 5. Convert OpenAI stream → async generator
  async function* stream() {
    for await (const event of response) {
      if (event.type === 'response.output_text.delta') {
        yield event.delta
      }
    }
  }

  // 5. Convert OpenAI stream → async generator
  // async function* stream() {
  //   for await (const event of response) {
  //     // OpenAI streams partial text deltas here
  //     const token = (event as any).delta || (event as any).output_text

  //     if (typeof token === 'string' && token.length > 0) {
  //       yield token
  //     }
  //   }
  // }

  return stream()
}

export async function queryRag({
  question,
  userType,
}: QueryRagParams): Promise<QueryResponse> {
  // Retrieve relevant chunks
  const chunks = await retrieveContext({
    question,
    userType,
  })

  // No useful matches
  if (!chunks.length) {
    return {
      success: true,
      answer: 'I don\'t know',
      sources: [],
    }
  }

  // Build prompt
  const prompt = buildPrompt({
    question,
    contextChunks: chunks.map((chunk) => chunk.text),
  })

  // Call OpenAI
  const completion = await openai.responses.create({
    model: constants.CHAT_MODEL,
    input: prompt,
  })

  const answer = completion.output_text?.trim()

  if (!answer) {
    throw new Error('No answer returned from OpenAI')
  }

  return {
    success: true,
    answer,

    sources: chunks.map((chunk) => ({
      text: chunk.text,
      score: chunk.score,
      source: chunk.source,
    })),
  }
}