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
      { type: 'response.completed' },
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

describe('queryRagStream failures', () => {
  beforeEach(() => {
    create.mockReset()
    mockedRetrieveContext.mockReset()
    mockedBuildPrompt.mockReset()
    mockedRetrieveContext.mockResolvedValue([{ text: 'context', score: 0.9 }])
    mockedBuildPrompt.mockReturnValue([{ role: 'user', content: 'prompt' }])
  })

  it('propagates retrieval and OpenAI request failures', async () => {
    mockedRetrieveContext.mockRejectedValueOnce(new Error('Retrieval failed'))
    await expect(queryRagStream({ question: 'hi', userType: 'pupil' })).rejects.toThrow('Retrieval failed')
    expect(create).not.toHaveBeenCalled()
    create.mockRejectedValueOnce(new Error('OpenAI unavailable'))
    await expect(queryRagStream({ question: 'hi', userType: 'pupil' })).rejects.toThrow('OpenAI unavailable')
  })

  it.each([
    [{ type: 'error', message: 'Service error' }, 'Service error'],
    [{ type: 'response.failed', response: { error: { message: 'Generation failed' } } }, 'Generation failed'],
    [{ type: 'response.failed', response: {} }, 'OpenAI response failed'],
    [{ type: 'response.incomplete', response: {} }, 'OpenAI response incomplete'],
    [null, 'OpenAI stream ended before completion'],
  ])('rejects failed or incomplete OpenAI stream %j', async (event, message) => {
    create.mockResolvedValue(createAsyncIterable([
      { type: 'response.output_text.delta', delta: 'partial' },
      ...(event ? [event] : []),
    ]))
    const result = await queryRagStream({ question: 'hi', userType: 'teacher' })
    expect(await result.stream.next()).toEqual({ done: false, value: 'partial' })
    await expect(result.stream.next()).rejects.toThrow(message as string)
    expect((await result.getFinal()).answer).toBe('partial')
  })
})

describe('queryRagStream cancellation', () => {
  beforeEach(() => {
    create.mockReset()
    mockedRetrieveContext.mockReset().mockResolvedValue([{ text: 'context', score: 0.9 }])
    mockedBuildPrompt.mockReset().mockReturnValue([{ role: 'user', content: 'prompt' }])
  })

  it('does not start retrieval or OpenAI for an already aborted request', async () => {
    const abort = new AbortController()
    abort.abort(new Error('Cancelled'))
    await expect(queryRagStream({ question: 'hi', userType: 'pupil' }, { signal: abort.signal })).rejects.toThrow('Cancelled')
    expect(mockedRetrieveContext).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it('does not start OpenAI if cancelled during retrieval', async () => {
    const abort = new AbortController()
    mockedRetrieveContext.mockImplementationOnce(async () => {
      abort.abort(new Error('Cancelled during retrieval'))
      return [{ text: 'context', score: 0.9 }]
    })
    await expect(queryRagStream({ question: 'hi', userType: 'pupil' }, { signal: abort.signal })).rejects.toThrow('Cancelled during retrieval')
    expect(create).not.toHaveBeenCalled()
  })

  it('passes the abort signal to OpenAI and treats even a silent SDK abort as failure', async () => {
    const abort = new AbortController()
    create.mockImplementationOnce(async (_body, { signal }) => {
      const cancelled = new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }))
      return {
        async *[Symbol.asyncIterator]() {
          yield { type: 'response.output_text.delta', delta: 'partial' }
          await cancelled // The SDK may end iteration without throwing on abort.
        },
      }
    })
    const result = await queryRagStream({ question: 'hi', userType: 'pupil' }, { signal: abort.signal })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ stream: true }), { signal: abort.signal })
    expect(await result.stream.next()).toEqual({ done: false, value: 'partial' })
    const next = result.stream.next()
    abort.abort(new Error('Cancelled OpenAI'))
    await expect(next).rejects.toThrow('Cancelled OpenAI')
  })

  it('does not emit a no-context response after cancellation', async () => {
    mockedRetrieveContext.mockResolvedValueOnce([])
    const abort = new AbortController()
    const result = await queryRagStream({ question: 'hi', userType: 'pupil' }, { signal: abort.signal })
    abort.abort(new Error('Cancelled fallback'))
    await expect(result.stream.next()).rejects.toThrow('Cancelled fallback')
    expect(create).not.toHaveBeenCalled()
  })
})
