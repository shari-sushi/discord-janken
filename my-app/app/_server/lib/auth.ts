import { validateSession } from "./session"

/**
 * Authorizationヘッダーを検証する
 * Bearer Token認証とBasic認証の両方をサポート
 */
export async function validateAuthHeader(authHeader: string | null): Promise<{
  valid: boolean
  username?: string
  error?: string
}> {
  if (!authHeader) {
    return { valid: false, error: "認証ヘッダーが必要です" }
  }

  // Bearer Token認証
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7)
    const isValid = await validateSession(token)

    if (!isValid) {
      return { valid: false, error: "無効な認証トークンです" }
    }

    // Note: セッションからユーザー名を取得する場合は、validateSessionを拡張する必要がある
    return { valid: true }
  }

  // Basic認証: GASやcurl向け
  if (authHeader.startsWith("Basic ")) {
    const base64Credentials = authHeader.substring(6)
    let credentials: string

    try {
      credentials = Buffer.from(base64Credentials, "base64").toString("utf-8")
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return { valid: false, error: "不正なBasic認証形式です" }
    }

    const [username, password] = credentials.split(":")

    if (!username || !password) {
      return { valid: false, error: "ユーザー名とパスワードが必要です" }
    }

    const allowedUsers = process.env.ALLOWED_USERS

    if (!allowedUsers) {
      console.error("ALLOWED_USERS is not configured")
      return { valid: false, error: "サーバー設定エラー" }
    }

    // ALLOWED_USERS をパース: "user1:pass1,user2:pass2" の形式
    const users = allowedUsers.split(",").map((entry) => {
      const [u, p] = entry.split(":")
      return { username: u.trim(), password: p.trim() }
    })

    // ユーザー名とパスワードを検証
    const user = users.find((u) => u.username === username && u.password === password)

    if (!user) {
      return { valid: false, error: "無効なユーザー名またはパスワードです" }
    }

    return { valid: true, username }
  }

  return { valid: false, error: "サポートされていない認証方式です（Bearer または Basic を使用してください）" }
}
