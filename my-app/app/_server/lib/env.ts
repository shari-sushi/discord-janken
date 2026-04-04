/**
 * サーバー専用環境変数の一元管理
 * アプリ起動時に必須環境変数を検証し、型安全なアクセスを提供します。
 */

/**
 * 必須環境変数を取得する
 * @param key - 環境変数名
 * @returns 環境変数の値
 * @throws {Error} 環境変数が未設定の場合（テスト環境を除く）
 */
function getRequiredEnv(key: string): string {
  const value = process.env[key]
  if (!value && process.env.NODE_ENV !== "test" && !process.env.GITHUB_ACTIONS) {
    throw new Error(`環境変数 ${key} が設定されていません`)
  }
  return value || ""
}

/**
 * オプション環境変数を取得する
 * @param key - 環境変数名
 * @param defaultValue - デフォルト値
 * @returns 環境変数の値、または未設定の場合はデフォルト値
 */
function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue
}

// デプロイ/ビルド環境
// vercelでは自動付与される。ローカル開発時は未設定のため "development" をデフォルトとする
export const ENV = getOptionalEnv("VERCEL_ENV", "development") as "production" | "preview" | "development"

// Discord関連
export const DISCORD_PUBLIC_KEY = getRequiredEnv("DISCORD_PUBLIC_KEY")
export const DISCORD_APPLICATION_ID = getRequiredEnv("DISCORD_APPLICATION_ID")
export const DISCORD_BOT_TOKEN = getRequiredEnv("DISCORD_BOT_TOKEN")
export const DISCORD_WEB_HOOK_URL = getRequiredEnv("DISCORD_WEB_HOOK_URL")
export const DISCORD_COMMAND_GUILD_ID = getOptionalEnv("DISCORD_COMMAND_GUILD_ID", "")
export const DISCORD_API_BASE_URL = "https://discord.com/api/v10"

// アプリURL
export const APP_URL = getRequiredEnv("APP_URL")

// 認証・アクセス制御
export const ALLOWED_USERS = getRequiredEnv("ALLOWED_USERS")
export const ADMIN_PASSWORD = getRequiredEnv("ADMIN_PASSWORD")
export const WEB_API_SECRET = getRequiredEnv("WEB_API_SECRET")

// データベース
export const REDIS_URL = getOptionalEnv("REDIS_URL", "redis://localhost:6379")

// Google Sheets
export const GOOGLE_SERVICE_ACCOUNT_JSON = getRequiredEnv("GOOGLE_SERVICE_ACCOUNT_JSON")
export const GOOGLE_SHEET_URL = getRequiredEnv("GOOGLE_SHEET_URL")

// Riot Games API
export const RIOT_API_KEY = getOptionalEnv("RIOT_API_KEY", "")

// QStash（非同期キュー）
export const QSTASH_URL = getRequiredEnv("QSTASH_URL")
export const QSTASH_TOKEN = getRequiredEnv("QSTASH_TOKEN")
export const QSTASH_CURRENT_SIGNING_KEY = getRequiredEnv("QSTASH_CURRENT_SIGNING_KEY")
export const QSTASH_NEXT_SIGNING_KEY = getRequiredEnv("QSTASH_NEXT_SIGNING_KEY")
