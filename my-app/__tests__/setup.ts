import { beforeAll, afterAll, afterEach, vi } from "vitest"

// ----------- memo -----------
// vi.mock("{path}", ... で、本番用コードのそのimportをmockに置き換えて実行できるんだって。すごい。
// ってことはディレクトリいじったら修正しないといけないね。でもコンパイルエラー出なさそうだから注意。

// vi.mock("@/app/_server/lib/redis/redis", () => ({
// redisGet:
//
// はそのpathにあるredisGetという関数を置き換えているってことで良いですか？
// ----------------------------

// Discord署名検証をモック化
vi.mock("discord-interactions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("discord-interactions")>()
  return {
    ...actual,
    verifyKey: vi.fn(async () => true), // 常に署名検証を通過
  }
})

// Redisモック用のインメモリストア ← これ天才よな
const redisStore = new Map<string, { value: string; expiresAt?: number }>()

// Redisクライアントをモック化
vi.mock("@/app/_server/lib/redis/redis", () => ({
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
    const serializedValue = typeof value === "object" ? JSON.stringify(value) : String(value)
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

    const serializedValue = typeof value === "object" ? JSON.stringify(value) : String(value)
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

// テスト環境の設定
beforeAll(() => {
  // Discord署名検証を無効化（テスト環境では不要）
  process.env.DISCORD_PUBLIC_KEY = "test-public-key"

  // その他の環境変数をモック用に設定
  process.env.REDIS_URL = "redis://localhost:6379"
  process.env.WEB_API_SECRET = "test-secret"
  process.env.ADMIN_PASSWORD = "test-admin-password"
  process.env.QSTASH_TOKEN = "test-qstash-token"
})

afterEach(() => {
  // 各テスト後にRedisストアをクリア
  redisStore.clear()
})

afterAll(() => {
  // 全テスト終了後のクリーンアップ
})
