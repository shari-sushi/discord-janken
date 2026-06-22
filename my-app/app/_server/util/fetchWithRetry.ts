/**
 * タイムアウト付き fetch をリトライする横断サーバーユーティリティ。
 *
 * 既存の `retryAfterRateLimit`（app/_server/lib/discord/api.ts）は Discord の 429 専用・単発のため、
 * 「失敗 or 無応答（タイムアウト）でリトライ」という汎用用途には流用できない。ここで汎用版を持つ。
 *
 * 環境非依存（グローバル fetch / AbortSignal.timeout を使う）。Vercel の Node/Edge どちらでも動く。
 */

export type FetchWithRetryOptions = {
  /** 1試行あたりのタイムアウト（ms）。これを過ぎたら abort してリトライ対象にする */
  timeoutMs?: number
  /** 最大試行回数（リトライ含む）。例: 3 = 初回 + 2リトライ */
  maxAttempts?: number
  /** 各リトライ前に待つ時間（ms）の配列。試行 i 回目の後に backoffMs[i-1] 待つ（足りなければ最後の値を流用） */
  backoffMs?: number[]
}

const DEFAULT_TIMEOUT_MS = 3000
const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_BACKOFF_MS = [500, 1000]

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * fetch をタイムアウト付きで実行し、失敗（例外 / タイムアウト / 非 2xx レスポンス）したらリトライする。
 * 最後の試行も失敗したら、最後に得たエラーを throw（非 2xx の場合はその Response を返さず Error を投げる）。
 * 呼び出し側は try/catch でログする想定。
 */
export async function fetchWithRetry(url: string, init?: RequestInit, options?: FetchWithRetryOptions): Promise<Response> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const backoffMs = options?.backoffMs ?? DEFAULT_BACKOFF_MS

  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // 各試行ごとに新しいタイムアウト signal を作る（使い回すと2回目以降が即 abort される）
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
      if (!res.ok) {
        // 非 2xx はリトライ対象。本文は読まずステータスだけ拾う（送信側は中身を使わない）
        throw new Error(`HTTP ${res.status}`)
      }
      return res
    } catch (error) {
      lastError = error
      // 最終試行でなければバックオフして再試行
      if (attempt < maxAttempts) {
        await sleep(backoffMs[Math.min(attempt - 1, backoffMs.length - 1)])
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}
