import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Mock } from 'vitest'

import { rateLimit } from '@/lib/common/rateLimit'
import { redis } from '@/lib/common/redis'

vi.mock('@/lib/common/redis', () => ({
  redis: {
    zremrangebyscore: vi.fn(),
    zcard: vi.fn(),
    zadd: vi.fn(),
    expire: vi.fn(),
  },
}))

const mockRedis = redis as unknown as {
  zremrangebyscore: Mock
  zcard: Mock
  zadd: Mock
  expire: Mock
}

describe('rateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.spyOn(Date, 'now').mockReturnValue(1000000)

    vi.spyOn(Math, 'random').mockReturnValue(0.123)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('allows request when under limit', async () => {
    mockRedis.zcard.mockResolvedValue(2)

    const result = await rateLimit({
      key: 'user-1',
      limit: 5,
      windowSec: 60,
    })

    expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
      'rate:user-1',
      0,
      940000
    )

    expect(mockRedis.zcard).toHaveBeenCalledWith(
      'rate:user-1'
    )

    expect(mockRedis.zadd).toHaveBeenCalledWith(
      'rate:user-1',
      1000000,
      '1000000-0.123'
    )

    expect(mockRedis.expire).toHaveBeenCalledWith(
      'rate:user-1',
      60
    )

    expect(result).toEqual({
      success: true,
      remaining: 2,
    })
  })

  it('blocks request when limit exceeded', async () => {
    mockRedis.zcard.mockResolvedValue(5)

    const result = await rateLimit({
      key: 'user-1',
      limit: 5,
      windowSec: 60,
    })

    expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
      'rate:user-1',
      0,
      940000
    )

    expect(mockRedis.zcard).toHaveBeenCalledWith(
      'rate:user-1'
    )

    expect(mockRedis.zadd).not.toHaveBeenCalled()

    expect(mockRedis.expire).not.toHaveBeenCalled()

    expect(result).toEqual({
      success: false,
      remaining: 0,
    })
  })
})
