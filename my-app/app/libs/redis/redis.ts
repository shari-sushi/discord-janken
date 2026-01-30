import { createClient, RedisClientType } from "redis"

let redis: RedisClientType | null = null

const getRedisClient = async (): Promise<RedisClientType> => {
  if (!redis) {
    redis = createClient()
    await redis.connect()
  }
  return redis
}

export const redisGet = async <T = string>(key: string): Promise<T | null> => {
  const client = await getRedisClient()
  const result = await client.get(key)
  if (result === null) {
    return null
  }
  try {
    return JSON.parse(result) as T
  } catch {
    return result as T
  }
}

export const redisSet = async (
  key: string,
  value: string | number | object,
  expiresInSeconds?: number
): Promise<void> => {
  const client = await getRedisClient()
  const serializedValue =
    typeof value === "object" ? JSON.stringify(value) : String(value)

  if (expiresInSeconds) {
    await client.setEx(key, expiresInSeconds, serializedValue)
  } else {
    await client.set(key, serializedValue)
  }
}

export const redisDelete = async (key: string): Promise<boolean> => {
  const client = await getRedisClient()
  const result = await client.del(key)
  return result > 0
}

export const redisUpdate = async (
  key: string,
  value: string | number | object,
  expiresInSeconds?: number
): Promise<boolean> => {
  const client = await getRedisClient()
  const exists = await client.exists(key)

  if (!exists) {
    return false
  }

  const serializedValue =
    typeof value === "object" ? JSON.stringify(value) : String(value)

  if (expiresInSeconds) {
    await client.setEx(key, expiresInSeconds, serializedValue)
  } else {
    await client.set(key, serializedValue)
  }

  return true
}

export const redisExists = async (key: string): Promise<boolean> => {
  const client = await getRedisClient()
  const result = await client.exists(key)
  return result > 0
}

export const redisDisconnect = async (): Promise<void> => {
  if (redis) {
    await redis.disconnect()
    redis = null
  }
}
