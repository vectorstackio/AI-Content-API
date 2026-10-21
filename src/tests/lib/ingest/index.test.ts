import crypto from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ingestUrl } from '@/lib/ingest'
import { scrapeUrl } from '@/lib/ingest/scrape'
import { chunkText } from '@/lib/ingest/chunk'
import { embedChunks } from '@/lib/ingest/embed'
import { index } from '@/lib/common/pinecone/client'
import type { ChunkMetadata } from '@/types'

vi.mock('@/lib/ingest/scrape', () => ({ scrapeUrl: vi.fn() }))
vi.mock('@/lib/ingest/chunk', () => ({ chunkText: vi.fn() }))
vi.mock('@/lib/ingest/embed', () => ({ embedChunks: vi.fn() }))
vi.mock('@/lib/common/pinecone/client', () => ({
  index: { upsert: vi.fn(), deleteMany: vi.fn(), query: vi.fn() },
}))

const url = 'https://example.com/article'
const text = 'This is usable scraped content for the ingestion test. '.repeat(3)
const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex')
type Vector = { id: string; values: number[]; metadata: ChunkMetadata }
const stored = new Map<string, Vector>()
const upsert = vi.mocked(index.upsert)
const remove = vi.mocked(index.deleteMany)
const ids = () => [...stored.keys()]
const db = vi.fn()

beforeEach(() => {
  for (const mock of [scrapeUrl, chunkText, embedChunks]) vi.mocked(mock).mockReset()
  upsert.mockReset()
  remove.mockReset()
  db.mockReset()
  stored.clear()
  vi.stubGlobal('fetch', db)
  db.mockResolvedValue({ ok: true, json: async () => ({ records: [] }) })
  vi.mocked(scrapeUrl).mockResolvedValue(text)
  vi.mocked(chunkText).mockReturnValue(['first chunk', 'second chunk'])
  vi.mocked(embedChunks).mockResolvedValue([[0.1, 0.2], [0.3, 0.4]])
  upsert.mockImplementation(async ({ records }) => {
    for (const record of records) stored.set(record.id, record as Vector)
  })
  remove.mockImplementation(async (options) => {
    const filter = (options as { filter: { url: { $eq: string }; userType: { $eq: string } } }).filter
    for (const [id, vector] of stored) {
      if (vector.metadata.url === filter.url.$eq && vector.metadata.userType === filter.userType.$eq) stored.delete(id)
    }
  })
})

describe('ingestUrl', () => {
  it('uses different IDs for all three audiences while preserving metadata and embeddings', async () => {
    for (const audience of ['pupil', 'teacher', 'tutor'] as const) {
      expect(await ingestUrl(url, audience)).toEqual({ chunks: 2 })
    }
    expect(stored.size).toBe(6)
    expect([...stored.values()].map(v => v.metadata.userType)).toEqual(['pupil', 'pupil', 'teacher', 'teacher', 'tutor', 'tutor'])
    expect([...stored.values()][0]).toMatchObject({
      values: [0.1, 0.2],
      metadata: { url, chunk: 'first chunk', chunkIndex: 0, contentHash: hash(text.replace(/\s+/g, ' ').trim()), userType: 'pupil' },
    })
    expect(remove).not.toHaveBeenCalled()
  })

  it('produces deterministic, bounded IDs for repeated input and unique chunks', async () => {
    const longUrl = `${url}?q=${'x'.repeat(5000)}`
    await ingestUrl(longUrl, 'teacher')
    const first = ids()
    await ingestUrl(longUrl, 'teacher')
    expect(ids()).toEqual(first)
    expect(new Set(first).size).toBe(2)
    for (const id of first) {
      expect(id).toMatch(/^[a-f0-9]{64}-teacher-[a-f0-9]{64}-chunk-\d+$/)
      expect(id.length).toBeLessThan(180)
    }
  })

  it('uses different IDs for different URLs', async () => {
    await ingestUrl(url, 'pupil')
    await ingestUrl(`${url}/other`, 'pupil')
    expect(stored.size).toBe(4)
  })

  it('uses different IDs for different content versions', async () => {
    await ingestUrl(url, 'pupil')
    vi.mocked(scrapeUrl).mockResolvedValue(`${text}Updated content`)
    await ingestUrl(url, 'pupil')
    expect(stored.size).toBe(4)
  })

  it('replaces only the matching URL and audience, including legacy IDs', async () => {
    await ingestUrl(url, 'teacher')
    await ingestUrl(`${url}/other`, 'pupil')
    const untouched = ids()
    stored.set(`${url}-oldhash-chunk-0`, { id: `${url}-oldhash-chunk-0`, values: [1], metadata: { url, userType: 'pupil', chunk: 'old' } })
    db.mockResolvedValueOnce({ ok: true, json: async () => ({ records: [{ _id: 'existing', url, userType: 'pupil', contentHash: 'oldhash' }] }) })
    await ingestUrl(url, 'pupil')
    expect(remove).toHaveBeenCalledExactlyOnceWith({ filter: { url: { $eq: url }, userType: { $eq: 'pupil' } } })
    expect(ids()).toEqual([...untouched, ...upsert.mock.calls.at(-1)![0].records.map(v => v.id)])
    expect(db.mock.calls.at(-1)?.[1]).toMatchObject({ method: 'PUT' })
  })

  it('encodes the source URL so its query parameters cannot alter the audience lookup', async () => {
    const source = `${url}?a=1&userType=tutor#section`
    await ingestUrl(source, 'pupil')
    const lookup = new URL(db.mock.calls[0][0])
    expect(lookup.searchParams.get('url')).toBe(source)
    expect(lookup.searchParams.getAll('userType')).toEqual(['pupil'])
    expect(db.mock.calls[1][1]).toMatchObject({ method: 'POST' })
  })

  it.each([false, true])('propagates upsert failure without writing the database (replacement: %s)', async (replacement) => {
    if (replacement) db.mockResolvedValueOnce({ ok: true, json: async () => ({ records: [{ _id: 'existing', contentHash: 'old' }] }) })
    upsert.mockRejectedValueOnce(new Error('Pinecone unavailable'))
    await expect(ingestUrl(url, 'pupil')).rejects.toThrow('Pinecone unavailable')
    expect(db).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledTimes(replacement ? 1 : 0)
  })

  it('continues to reject unchanged normalized content before deleting or upserting', async () => {
    db.mockResolvedValueOnce({ ok: true, json: async () => ({ records: [{ contentHash: hash(text.replace(/\s+/g, ' ').trim()) }] }) })
    await expect(ingestUrl(url, 'pupil')).rejects.toThrow('The content of the URL has not changed')
    expect(remove).not.toHaveBeenCalled()
    expect(upsert).not.toHaveBeenCalled()
    expect(embedChunks).not.toHaveBeenCalled()
  })

  it('rejects missing URLs, unusable content and empty chunks', async () => {
    await expect(ingestUrl('', 'pupil')).rejects.toThrow('URL is required')
    expect(scrapeUrl).not.toHaveBeenCalled()
    vi.mocked(scrapeUrl).mockResolvedValueOnce('short')
    await expect(ingestUrl(url, 'pupil')).rejects.toThrow('No usable content')
    vi.mocked(chunkText).mockReturnValueOnce([])
    await expect(ingestUrl(url, 'pupil')).rejects.toThrow('No chunks generated')
    expect(upsert).not.toHaveBeenCalled()
  })
})

// These characterize the existing replacement ordering. Activation/rollback is
// deliberately not assumed: deletion still precedes chunking, embedding and upsert.
describe('ingestion failure ordering', () => {
  const existing = { _id: 'existing', url, userType: 'pupil', contentHash: 'oldhash' }
  const seedOld = () => {
    stored.set('legacy-id', { id: 'legacy-id', values: [1], metadata: { url, userType: 'pupil', chunk: 'old content' } })
    db.mockResolvedValueOnce({ ok: true, json: async () => ({ records: [existing] }) })
  }

  it('leaves old vectors intact when scraping fails', async () => {
    seedOld()
    vi.mocked(scrapeUrl).mockRejectedValueOnce(new Error('Scraping failed'))
    await expect(ingestUrl(url, 'pupil')).rejects.toThrow('Scraping failed')
    expect(ids()).toEqual(['legacy-id'])
    expect(db).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
  })

  it('currently deletes old vectors before an embedding failure', async () => {
    seedOld()
    vi.mocked(embedChunks).mockRejectedValueOnce(new Error('Embedding failed'))
    await expect(ingestUrl(url, 'pupil')).rejects.toThrow('Embedding failed')
    expect(ids()).toEqual([])
    expect(upsert).not.toHaveBeenCalled()
    expect(db).toHaveBeenCalledTimes(1)
  })

  it('currently leaves only the partial upload when replacement upsert times out', async () => {
    seedOld()
    upsert.mockImplementationOnce(async ({ records }) => {
      stored.set(records[0].id, records[0] as Vector)
      throw new Error('Upload timed out')
    })
    await expect(ingestUrl(url, 'pupil')).rejects.toThrow('Upload timed out')
    expect(stored.size).toBe(1)
    expect(stored.has('legacy-id')).toBe(false)
    expect([...stored.values()][0].metadata.chunk).toBe('first chunk')
    expect(db).toHaveBeenCalledTimes(1)
  })

  it('propagates legacy-vector deletion failure before embedding or persistence', async () => {
    seedOld()
    remove.mockRejectedValueOnce(new Error('Delete failed'))
    await expect(ingestUrl(url, 'pupil')).rejects.toThrow('Delete failed')
    expect(ids()).toEqual(['legacy-id'])
    expect(embedChunks).not.toHaveBeenCalled()
    expect(upsert).not.toHaveBeenCalled()
    expect(db).toHaveBeenCalledTimes(1)
  })

  it.each([false, true])('rejects DB persistence HTTP errors after upload (existing: %s)', async replacement => {
    if (replacement) seedOld()
    else db.mockResolvedValueOnce({ ok: true, json: async () => ({ records: [] }) })
    db.mockResolvedValueOnce({ ok: false, status: 503 })
    await expect(ingestUrl(url, 'pupil')).rejects.toThrow('Ingestion persistence failed (503)')
    expect(stored.size).toBe(2) // Uploaded vectors are not rolled back by current code.
    expect(db.mock.calls.at(-1)?.[1]?.method).toBe(replacement ? 'PUT' : 'POST')
  })

  it('propagates a persistence network failure without claiming ingestion succeeded', async () => {
    db.mockResolvedValueOnce({ ok: true, json: async () => ({ records: [] }) })
    db.mockRejectedValueOnce(new Error('Database network failure'))
    await expect(ingestUrl(url, 'pupil')).rejects.toThrow('Database network failure')
    expect(stored.size).toBe(2)
  })

  it.each([
    { ok: false, status: 500 },
    { ok: true, json: async () => ({ records: {} }) },
    { ok: true, json: async () => { throw new SyntaxError('Malformed JSON') } },
  ])('does not delete or upload after a bad DB lookup response %j', async response => {
    db.mockResolvedValueOnce(response)
    await expect(ingestUrl(url, 'pupil')).rejects.toThrow()
    expect(remove).not.toHaveBeenCalled()
    expect(upsert).not.toHaveBeenCalled()
  })

  it('treats missing lookup records as a new URL', async () => {
    db.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await expect(ingestUrl(url, 'pupil')).resolves.toEqual({ chunks: 2 })
    expect(db.mock.calls[1][1].method).toBe('POST')
  })
})
