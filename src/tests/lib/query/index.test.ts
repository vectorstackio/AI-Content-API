import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { MockedFunction } from 'vitest'

function createAsyncIterable(events: unknown[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) {
        yield event
      }
    },
  }
}

import { queryRagStream } from '@/lib/query'
import { retrieveContext } from '@/lib/query/retrieve'
import { buildPrompt } from '@/lib/query/prompt'

vi.mock('@/lib/query/retrieve', () => ({ retrieveContext: vi.fn() }))
vi.mock('@/lib/query/prompt', () => ({ buildPrompt: vi.fn() }))

const { create } = vi.hoisted(() => ({ create: vi.fn() }))

vi.mock('openai', () => ({
  default: class {
    responses = { create }
  },
}))

const mockedRetrieveContext = retrieveContext as MockedFunction<
  typeof retrieveContext
>

const mockedBuildPrompt = buildPrompt as MockedFunction<
  typeof buildPrompt
>

describe('queryRagStream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    create.mockReturnValue(createAsyncIterable([
      { type: 'response.created' },
      { type: 'response.output_text.delta', delta: 'Hello ' },
      { type: 'response.output_text.done', text: 'ignored' },
      { type: 'response.output_text.delta', delta: 'world' },
    ]))
  })

  it('returns "I don’t know" stream when no context is found', async () => {
    mockedRetrieveContext.mockResolvedValue([])

    const result = await queryRagStream({
      question: 'hello',
      userType: 'pupil',
    })

    const streamed: string[] = []

    for await (const chunk of result.stream) {
      streamed.push(chunk)
    }

    expect(streamed).toEqual(['I don\'t know'])
    expect(create).not.toHaveBeenCalled()
    expect(result.status).toBe('unknown')

    const final = await result.getFinal()

    expect(final).toEqual({
      answer: 'I don\'t know',
      sources: [],
    })

  })

  it('streams OpenAI deltas and builds final answer', async () => {
    mockedRetrieveContext.mockResolvedValue([
      {
        text: 'chunk A',
        score: 0.9,
        source: 'doc1',
      },
    ])

    mockedBuildPrompt.mockReturnValue([
      { role: 'user', content: 'prompt' },
    ])

    const result = await queryRagStream({
      question: 'hi',
      userType: 'pupil',
    })

    const streamed: string[] = []

    for await (const chunk of result.stream) {
      streamed.push(chunk)
    }

    expect(streamed).toEqual(['Hello ', 'world'])
    expect(result.status).toBe('answered')

    const final = await result.getFinal()

    expect(final).toEqual({
      answer: 'Hello world',
      sources: [
        {
          text: 'chunk A',
          score: 0.9,
          source: 'doc1',
        },
      ],
    })
  })

  it('ignores non-delta events in stream', async () => {
    mockedRetrieveContext.mockResolvedValue([
      {
        text: 'chunk',
        score: 0.5,
      },
    ])

    mockedBuildPrompt.mockReturnValue([
      { role: 'user', content: 'prompt' },
    ])

    const result = await queryRagStream({
      question: 'test',
      userType: 'pupil',
    })

    const streamed: string[] = []

    for await (const chunk of result.stream) {
      streamed.push(chunk)
    }

    expect(streamed).toEqual(['Hello ', 'world'])
    expect(result.status).toBe('answered')

    const final = await result.getFinal()

    expect(final.answer).toBe('Hello world')
  })
})
