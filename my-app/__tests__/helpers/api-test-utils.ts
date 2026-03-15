import { NextRequest } from "next/server"

/**
 * テスト用のNextRequestを作成
 */
export const createTestRequest = (
  url: string,
  options: {
    method?: string
    body?: string | object
    headers?: Record<string, string>
  } = {},
): NextRequest => {
  const { method = "GET", body, headers = {} } = options
  const requestBody = typeof body === "object" ? JSON.stringify(body) : body

  // デフォルトヘッダー（Discord署名検証用）
  const defaultHeaders = {
    "x-signature-ed25519": "test-signature",
    "x-signature-timestamp": Date.now().toString(),
    "content-type": "application/json",
    ...headers,
  }

  return new NextRequest(url, {
    method,
    headers: defaultHeaders,
    body: requestBody,
  })
}

/**
 * Discord APIエンドポイントへのリクエストを作成
 */
export const createDiscordRequest = (payload: object): NextRequest => {
  return createTestRequest("http://localhost:3000/api/discord", {
    method: "POST",
    body: payload,
  })
}

/**
 * Web APIエンドポイントへのリクエストを作成
 */
export const createWebApiRequest = (
  path: string,
  options: {
    method?: string
    body?: string | object
    headers?: Record<string, string>
  } = {},
): NextRequest => {
  return createTestRequest(`http://localhost:3000/api/web${path}`, options)
}

/**
 * レスポンスをJSONとしてパース
 */
// TODO: 戻り値ちゃんとしたい。型ガードで条件分岐させるかジェネリクスか…？
export const parseJsonResponse = async (response: Response) => {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Failed to parse JSON response: ${text}`)
  }
}
