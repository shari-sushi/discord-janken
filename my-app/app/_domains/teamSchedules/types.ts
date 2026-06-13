/**
 * スクリム調整機能 - フロント/サーバー共通のドメイン型
 *
 * DBスキーマ（Drizzle / PostgreSQL）と対応するが、APIをまたぐJSONの形として
 * camelCase で定義する。サーバー側はこの型に合わせてレスポンスを組み立てる。
 */

/** 予定の状態。未記入は「行が無い」状態で表現するため、ここには含めない */
export type ScheduleStatus = "ok" | "maybe" | "ng"

/** チーム内の権限ロール */
export type TeamRole = "individual" | "admin"

/** YYYY-MM-DD 形式の日付（時刻なし・カレンダー日付） */
export type DayKey = string

/** LoLロールの担当可否（can-play） */
export type LolRoleFlags = {
  top: boolean
  jungle: boolean
  mid: boolean
  adc: boolean
  support: boolean
}

/** チームの基本情報（セレクタ表示用） */
export type TeamSummary = {
  teamId: string
  name: string
  description: string | null
  /** 「活動可能」と判定するのに必要な ok の人数（自=5, 相手=1） */
  requiredCount: number
}

/** チームの所属メンバー */
export type TeamScheduleMember = {
  userId: string
  displayName: string
  teamRole: TeamRole
  roles: LolRoleFlags
}

/** 1人・1日・1チームぶんの予定 */
export type ScheduleEntry = {
  userId: string
  day: DayKey
  status: ScheduleStatus
  note: string | null
}

/** グリッド描画に必要な、1チームぶんの全データ */
export type TeamSchedule = {
  teamId: string
  name: string
  description: string | null
  requiredCount: number
  members: TeamScheduleMember[]
  schedules: ScheduleEntry[]
}

/** ログイン中のユーザー（未ログインは null） */
export type SessionUser = {
  userId: string
  displayName: string
}
