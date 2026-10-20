import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Mock } from 'vitest'

import { dbConnect } from '@/lib/common/db'
import mongoose from 'mongoose'
import config from '@/lib/common/config'


vi.mock('@/lib/common/config', () => ({
  default: { db: { url: '' } },
}))

const mockMongoose = mongoose as unknown as {
  connect: Mock
}

describe('dbConnect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws error when db url is missing', async () => {
    ; (config.db as { url: string }).url = ''

    await expect(dbConnect()).rejects.toThrow(
      'Please define the MONGODB_URI environment variable'
    )
  })

  it('calls mongoose.connect and returns mongoose instance', async () => {
    ; (config.db as { url: string }).url = 'mongodb://localhost:27017/test'

    mockMongoose.connect.mockResolvedValue({})

    const result = await dbConnect()

    expect(mockMongoose.connect).toHaveBeenCalledWith(
      'mongodb://localhost:27017/test'
    )

    expect(result).toBe(mongoose)
  })
})
