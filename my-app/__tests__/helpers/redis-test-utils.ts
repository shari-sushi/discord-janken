import { vi } from 'vitest'

// インメモリRedisストア（テスト用）
const redisStore = new Map<string, { value: string; expiresAt?: number }>()

/**
 * Redisモックのセットアップ
 */
export const setupRedisMock = () => {
  // Redisクライアントをモック化
  vi.mock('@/app/_server/lib/redis/redis', () => ({
    redisGet: vi.fn(async <T = string>(key: string): Promise<T | null> => {
      const entry = redisStore.get(key)

      if (!entry) {
        return null
      }

      // 有効期限チェック
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        redisStore.delete(key)
        return null
      }

      try {
        return JSON.parse(entry.value) as T
      } catch {
        return entry.value as T
      }
    }),

    redisSet: vi.fn(async (key: string, value: string | number | object, expiresInSeconds?: number): Promise<void> => {
      const serializedValue = typeof value === 'object' ? JSON.stringify(value) : String(value)

      const expiresAt = expiresInSeconds ? Date.now() + expiresInSeconds * 1000 : undefined

      redisStore.set(key, { value: serializedValue, expiresAt })
    }),

    redisDelete: vi.fn(async (key: string): Promise<boolean> => {
      return redisStore.delete(key)
    }),

    redisUpdate: vi.fn(async (key: string, value: string | number | object, expiresInSeconds?: number): Promise<boolean> => {
      const exists = redisStore.has(key)

      if (!exists) {
        return false
      }

      const serializedValue = typeof value === 'object' ? JSON.stringify(value) : String(value)
      const expiresAt = expiresInSeconds ? Date.now() + expiresInSeconds * 1000 : undefined

      redisStore.set(key, { value: serializedValue, expiresAt })
      return true
    }),

    redisExists: vi.fn(async (key: string): Promise<boolean> => {
      return redisStore.has(key)
    }),

    redisMGet: vi.fn(async <T = string>(keys: string[]): Promise<(T | null)[]> => {
      return keys.map((key) => {
        const entry = redisStore.get(key)

        if (!entry) {
          return null
        }

        // 有効期限チェック
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
          redisStore.delete(key)
          return null
        }

        try {
          return JSON.parse(entry.value) as T
        } catch {
          return entry.value as T
        }
      })
    }),

    redisDisconnect: vi.fn(async (): Promise<void> => {
      // テストではモックなので何もしない
    }),
  }))
}

/**
 * Redisストアをクリア
 */
export const clearRedisStore = () => {
  redisStore.clear()
}

/**
 * Redisストアの内容を取得（デバッグ用）
 */
export const getRedisStore = () => {
  return new Map(redisStore)
}
