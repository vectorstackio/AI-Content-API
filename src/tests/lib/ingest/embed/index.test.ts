import { beforeEach, describe, expect, it, vi } from 'vitest'
import { embedChunks } from '@/lib/ingest/embed'
import { EMBEDDING_MODEL } from '@/lib/common/constants'

const { create } = vi.hoisted(() => ({ create: vi.fn() }))

vi.mock('openai', () => ({
  default: class {
    embeddings = { create }
  },
}))

describe('embedChunks', () => {
  beforeEach(() => {
    create.mockReset()
  })

  it('requests the configured model and maps returned embeddings in order', async () => {
    create.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2] }, { embedding: [0.3, 0.4] }],
    })

    await expect(embedChunks(['hello', 'world'])).resolves.toEqual([
      [0.1, 0.2], [0.3, 0.4],
    ])
    expect(create).toHaveBeenCalledExactlyOnceWith({
      model: EMBEDDING_MODEL,
      input: ['hello', 'world'],
    })
  })

  it('propagates embedding API failures', async () => {
    create.mockRejectedValue(new Error('Embedding API unavailable'))
    await expect(embedChunks(['hello'])).rejects.toThrow('Embedding API unavailable')
  })
})
