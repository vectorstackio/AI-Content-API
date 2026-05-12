// lib/common/rateLimit/index.ts

import Redis from 'ioredis'

const redis = new Redis({
  host: '127.0.0.1',
  port: 6379,
})

export async function rateLimit({
  key,
  limit,
  windowSec,
}: {
  key: string
  limit: number
  windowSec: number
}) {
  const now = Date.now()
  const windowStart = now - windowSec * 1000

  const redisKey = `rate:${key}`

  // remove old requests outside the window
  await redis.zremrangebyscore(redisKey, 0, windowStart)

  // count current requests
  const count = await redis.zcard(redisKey)

  if (count >= limit) {
    return {
      success: false,
      remaining: 0,
    }
  }

  // add current request
  await redis.zadd(redisKey, now, `${now}-${Math.random()}`)

  // set expiry to avoid memory leaks
  await redis.expire(redisKey, windowSec)

  return {
    success: true,
    remaining: limit - (count + 1),
  }
}