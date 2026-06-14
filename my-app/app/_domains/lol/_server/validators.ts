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

/**
 * isRoleSelect パラメータの検証
 * @param isRoleSelect - 検証対象のパラメータ
 * @returns バリデーション結果
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateIsRoleSelect(isRoleSelect: any): ValidationResult {
  // undefined の場合は false として扱うため、valid とする
  if (isRoleSelect === undefined) {
    return { valid: true }
  }

  // boolean型チェック
  if (typeof isRoleSelect !== "boolean") {
    return { valid: false, error: "isRoleSelectはboolean型である必要があります" }
  }

  return { valid: true }
}

/**
 * members パラメータの検証
 * @param members - 検証対象のメンバーリスト
 * @returns バリデーション結果
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateMembers(members: any): ValidationResult {
  // 型チェック: membersがオブジェクトであること
  if (typeof members !== "object" || members === null || Array.isArray(members)) {
    return { valid: false, error: "membersはオブジェクトである必要があります" }
  }

  // blueTeam の型チェック
  if (!Array.isArray(members.blueTeam)) {
    return { valid: false, error: "members.blue_teamは配列である必要があります" }
  }

  // redTeam の型チェック
  if (!Array.isArray(members.redTeam)) {
    return { valid: false, error: "members.red_teamは配列である必要があります" }
  }

  // 長さチェック: 各チーム5名
  if (members.blueTeam.length !== 5) {
    return { valid: false, error: "members.blue_teamは5名である必要があります" }
  }

  if (members.redTeam.length !== 5) {
    return { valid: false, error: "members.red_teamは5名である必要があります" }
  }

  // 要素チェック: 各要素が文字列であること
  for (const member of members.blueTeam) {
    if (typeof member !== "string") {
      return { valid: false, error: "members.blueTeamの要素は文字列である必要があります" }
    }
    if (member.trim() === "") {
      return { valid: false, error: "members.blueTeamに空文字列が含まれています" }
    }
  }

  for (const member of members.redTeam) {
    if (typeof member !== "string") {
      return { valid: false, error: "members.redTeamの要素は文字列である必要があります" }
    }
    if (member.trim() === "") {
      return { valid: false, error: "members.redTeamに空文字列が含まれています" }
    }
  }

  // チーム内重複チェック
  const blueTeamSet = new Set(members.blueTeam)
  if (blueTeamSet.size !== members.blueTeam.length) {
    return { valid: false, error: "members.blueTeamに重複が存在します" }
  }

  const redTeamSet = new Set(members.redTeam)
  if (redTeamSet.size !== members.redTeam.length) {
    return { valid: false, error: "members.redTeamに重複が存在します" }
  }

  // クロスチーム重複チェック
  const allMembers = [...members.blueTeam, ...members.redTeam]
  const allMembersSet = new Set(allMembers)
  if (allMembersSet.size !== allMembers.length) {
    return { valid: false, error: "ブルーチームとレッドチームで同じメンバーが重複しています" }
  }

  return { valid: true }
}

// 時刻文字列をUTCのDateに変換（ISO 8601 UTC / HH:MM JST / M分後）
export const parseReminderAt = (input: string): Date | null => {
  const now = new Date()

  // web api用
  // ISO 8601 UTC形式（例: "2024-01-15T01:05:00.000Z"）
  const isoMatch = input.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/)
  if (isoMatch) {
    const date = new Date(input)
    return isNaN(date.getTime()) ? null : date
  }
  // "M分後" 形式
  const minutesMatch = input.match(/^(\d+)分後$/)
  if (minutesMatch) {
    const minutes = parseInt(minutesMatch[1], 10)
    return new Date(now.getTime() + minutes * 60 * 1000)
  }

  // 以下、discord botのtext input用
  // "HH:MM" 形式（JSTとして解釈しUTCに変換）
  const timeMatch = input.match(/^(\d{1,2}):(\d{2})$/)
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10)
    const minutes = parseInt(timeMatch[2], 10)
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

    // JSTで指定された時刻をUTCに変換して設定（JST = UTC+9）
    const targetDate = new Date()
    targetDate.setUTCHours(hours - 9, minutes, 0, 0)
    if (targetDate <= now) {
      targetDate.setUTCDate(targetDate.getUTCDate() + 1)
    }
    return targetDate
  }

  return null
}
