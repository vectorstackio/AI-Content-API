// lib/common/rateLimit/__tests__/rateLimit.test.ts

import { rateLimit } from '@/lib/common/rateLimit'
import { redis } from '@/lib/common/redis'

jest.mock('@/lib/common/redis', () => ({
  redis: {
    zremrangebyscore: jest.fn(),
    zcard: jest.fn(),
    zadd: jest.fn(),
    expire: jest.fn(),
  },
}))

const mockRedis = redis as unknown as {
  zremrangebyscore: jest.Mock
  zcard: jest.Mock
  zadd: jest.Mock
  expire: jest.Mock
}

describe('rateLimit', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    jest.spyOn(Date, 'now').mockReturnValue(1000000)

    jest.spyOn(Math, 'random').mockReturnValue(0.123)
  })

  afterEach(() => {
    jest.restoreAllMocks()
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