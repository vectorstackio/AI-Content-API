// lib/common/redis/index.ts

import Redis from 'ioredis'

export const redis = new Redis({
  lazyConnect: true,
  host: '127.0.0.1',
  port: 6379,
})
