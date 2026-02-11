/**
 * Discord関連のバリデーション関数
 */

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Discord ID（guild_id, channel_id等）のフォーマットを検証
 * Discord IDはSnowflake形式（17-19桁の数値文字列）
 * @param id - 検証対象のID
 * @returns バリデーション結果
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateDiscordId(id: any): ValidationResult {
  // 存在チェック
  if (id === undefined || id === null) {
    return { valid: false, error: "IDが指定されていません" }
  }

  // 文字列型チェック
  if (typeof id !== "string") {
    return { valid: false, error: "IDは文字列である必要があります" }
  }

  // 空文字列チェック
  if (id.trim() === "") {
    return { valid: false, error: "IDが空です" }
  }

  // Snowflake ID形式チェック（17-19桁の数値文字列）
  const snowflakePattern = /^\d{17,19}$/
  if (!snowflakePattern.test(id)) {
    return { valid: false, error: "IDの形式が不正です（17-19桁の数値である必要があります）" }
  }

  return { valid: true }
}

/**
 * isProtect パラメータの検証
 * @param isProtect - 検証対象のパラメータ
 * @returns バリデーション結果
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateIsProtect(isProtect: any): ValidationResult {
  // undefined の場合は false として扱うため、valid とする
  if (isProtect === undefined) {
    return { valid: true }
  }

  // boolean型チェック
  if (typeof isProtect !== "boolean") {
    return { valid: false, error: "isProtectはboolean型である必要があります" }
  }

  return { valid: true }
}
