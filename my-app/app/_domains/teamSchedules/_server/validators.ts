/**
 * スクリム調整機能 - サーバー専用バリデーション・型ガード
 *
 * クライアントからの入力（status / day / note）を信用せず、ここで検証する。
 */

import { MIN_REQUIRED_COUNT, type DayKey, type ScheduleStatus, type TeamManagementMode } from "@/app/_domains/teamSchedules/types"

/** status が ok / maybe / ng の3値のいずれかか */
export function isScheduleStatus(value: unknown): value is ScheduleStatus {
  return value === "ok" || value === "maybe" || value === "ng"
}

/** 管理モードが members / team のいずれかか */
export function isManagementMode(value: unknown): value is TeamManagementMode {
  return value === "members" || value === "team"
}

/** チーム名として妥当か（1〜50文字・空白のみ不可） */
const TEAM_NAME_MAX_LENGTH = 50
export function isValidTeamName(value: unknown): value is string {
  if (typeof value !== "string") return false
  const trimmed = value.trim()
  return trimmed.length >= 1 && trimmed.length <= TEAM_NAME_MAX_LENGTH
}

/** チーム説明として妥当か（null or 200文字以内） */
const DESCRIPTION_MAX_LENGTH = 200
export function isValidTeamDescription(value: unknown): value is string | null {
  if (value === null) return true
  return typeof value === "string" && value.length <= DESCRIPTION_MAX_LENGTH
}

/** requiredCount として妥当か（最小値以上の整数） */
export function isValidRequiredCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_REQUIRED_COUNT
}

/** YYYY-MM-DD 形式のカレンダー日付か（実在日付までは厳密に見ない簡易チェック） */
export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== "string") return false
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** note は文字列 or null（長すぎる入力は弾く） */
const NOTE_MAX_LENGTH = 200
export function isValidNote(value: unknown): value is string | null {
  if (value === null) return true
  return typeof value === "string" && value.length <= NOTE_MAX_LENGTH
}

/** UUID v4 形式か（teamId / userId の経路バリデーション用。DBは gen_random_uuid() = v4 を発行する） */
export function isUuid(value: unknown): value is string {
  if (typeof value !== "string") return false
  // version=4（3ブロック目先頭が 4）・variant=8/9/a/b（4ブロック目先頭）を厳密に見る
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
