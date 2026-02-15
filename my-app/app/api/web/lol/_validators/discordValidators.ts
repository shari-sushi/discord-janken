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
    return { valid: false, error: "members.blueTeamは配列である必要があります" }
  }

  // redTeam の型チェック
  if (!Array.isArray(members.redTeam)) {
    return { valid: false, error: "members.redTeamは配列である必要があります" }
  }

  // 長さチェック: 各チーム5名
  if (members.blueTeam.length !== 5) {
    return { valid: false, error: "members.blueTeamは5名である必要があります" }
  }

  if (members.redTeam.length !== 5) {
    return { valid: false, error: "members.redTeamは5名である必要があります" }
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
    return { valid: false, error: "青チームと赤チームで同じメンバーが重複しています" }
  }

  return { valid: true }
}
