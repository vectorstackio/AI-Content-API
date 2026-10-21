// lib/ingest/index.ts

import crypto from 'crypto'
import { Document } from 'mongoose'

import { scrapeUrl } from '@/lib/ingest/scrape'
import { chunkText } from '@/lib/ingest/chunk'
import { embedChunks } from '@/lib/ingest/embed'
import { upsertVectors, deleteVectors } from '@/lib/common/pinecone'
import { ClientError } from '@/lib/common/error'
import config from '@/lib/common/config'

type UserType = 'pupil' | 'teacher' | 'tutor'

interface DbRecord extends Document {
  url: string
  content: string
  contentHash: string
  userType: string
}

interface CheckUrlExistsResult {
  exists: boolean
  unchanged: boolean
  record?: DbRecord
}

/**
 * @function ingestUrl        Ingest the contents of a user supplied URL.
 *
 * @param  {string} url       The URL being ingested.
 * @param  {string} userType  The URL being ingested.
 * @return {object}
 */
export const ingestUrl = async (url: string, userType: UserType) => {
  if (!url) throw new ClientError('URL is required')

  // 1. Scrape
  const text = await scrapeUrl(url)

  if (!text || text.length < 50) {
    throw new ClientError('No usable content scraped from URL')
  }

  // 2. Check for existing URL
  const normalized = text.replace(/\s+/g, ' ').trim()
  const contentHash = createHash(normalized)
  const result = await checkUrlExists(url, userType, contentHash)
  if (result.exists) {
    if (result.unchanged) throw new ClientError('The content of the URL has not changed')
    await deleteVectors({
      filter: {
        url: { $eq: url },
        userType: { $eq: userType },
      },
    })
  }

  // 3. Chunk
  const chunks = chunkText(text)

  if (!chunks.length) {
    throw new ClientError('No chunks generated from content')
  }

  // 4. Embed
  const embeddings = await embedChunks(chunks)

  // 5. Upsert to Pinecone
  const urlHash = createHash(url)
  const vectors = chunks.map((chunk, i) => ({
    id: `${urlHash}-${userType}-${contentHash}-chunk-${i}`,
    values: embeddings[i],
    metadata: {
      url,
      chunk,
      chunkIndex: i,
      contentHash,
      userType,
    },
  }))

  await upsertVectors({ vectors })
  await updateDb(url, text, contentHash, userType, result.record ?? null)

  return {
    chunks: chunks.length,
  }
}

const createHash = (text: string) => {
  return crypto.createHash('sha256').update(text).digest('hex')
}

const checkUrlExists = async (url: string, userType: UserType, contentHash: string): Promise<CheckUrlExistsResult> => {
  const response = await fetch(
    `${config.app.apiUrl}/api/v02/db/hubAiUrls?url=${encodeURIComponent(url)}&userType=${userType}&tspAuthToken=${config.app.apiAuthToken}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    }
  )
  const data = await response.json()
  const records = data.records ?? []
  const existing = records.length ? records[0] : null

  if (existing) {
    if (existing.contentHash === contentHash) {
      return { exists: true, unchanged: true }
    }
    return { exists: true, unchanged: false, record: existing }
  } else {
    return { exists: false, unchanged: false }
  }
}

const updateDb = async (url: string, content: string, contentHash: string, userType: string, existing: DbRecord | null = null) => {
  if (existing) {
    const { _id, ...rest } = existing
    rest.content = content
    rest.contentHash = contentHash
    rest.userType = userType
    await fetch(`${config.app.apiUrl}/api/v02/db/hubAiUrls/${_id}?tspAuthToken=${config.app.apiAuthToken}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rest),
    })
    return rest
  }
  return createRecord(url, content, contentHash, userType)
}

const createRecord = async (url: string, content: string, contentHash: string, userType: string) => {
  const data = { url, content, contentHash, userType }
  await fetch(`${config.app.apiUrl}/api/v02/db/hubAiUrls?tspAuthToken=${config.app.apiAuthToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return data
}
