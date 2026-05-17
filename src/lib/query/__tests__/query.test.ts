// lib/query/__tests__/query.test.ts

jest.mock('@pinecone-database/pinecone', () => {
  return {
    Pinecone: jest.fn().mockImplementation(() => ({
      index: jest.fn(),
    })),
  }
})

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

jest.mock('@/lib/query/retrieve')
jest.mock('../prompt')

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn(() => ({
      responses: {
        create: jest.fn(() => createAsyncIterable([
          { type: 'response.output_text.delta', delta: 'Hello ' },
          { type: 'response.output_text.delta', delta: 'world' },
        ])),
      },
    })),
  }
})

const mockedRetrieveContext = retrieveContext as jest.MockedFunction<
  typeof retrieveContext
>

const mockedBuildPrompt = buildPrompt as jest.MockedFunction<
  typeof buildPrompt
>

describe('queryRagStream', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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

    expect(streamed).not.toBe('')

    const final = await result.getFinal()

    expect(final.answer).toBe('Hello world')
  })
})