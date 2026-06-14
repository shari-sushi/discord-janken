/**
 * スクリム調整機能 - サーバー専用バリデーション・型ガード
 *
 * クライアントからの入力（status / day / note）を信用せず、ここで検証する。
 */

import type { DayKey, ScheduleStatus } from "@/app/_domains/teamSchedules/types"

/** status が ok / maybe / ng の3値のいずれかか */
export function isScheduleStatus(value: unknown): value is ScheduleStatus {
  return value === "ok" || value === "maybe" || value === "ng"
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

/** UUID v4 形式か（teamId / userId の経路バリデーション用） */
export function isUuid(value: unknown): value is string {
  if (typeof value !== "string") return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
