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

/**
 * チームの活動可否の管理方法。
 * - members: 各メンバーが予定を入力し、ok数 >= requiredCount で活動可能
 * - team:    admin がチーム単位で日別状態を入力（team_day_status）
 */
export type TeamManagementMode = "members" | "team"

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
  /** 「活動可能」と判定するのに必要な ok の人数（members モードで使用） */
  requiredCount: number
  /** 活動可否の管理方法 */
  managementMode: TeamManagementMode
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

/** チーム単位モードの1日ぶんの状態（team_day_status 1行） */
export type TeamDayStatusEntry = {
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
  managementMode: TeamManagementMode
  members: TeamScheduleMember[]
  /** members モードの個人別予定 */
  schedules: ScheduleEntry[]
  /** team モードのチーム単位日別状態（members モードでは空配列） */
  teamStatus: TeamDayStatusEntry[]
}

/** ログイン中のユーザー（未ログインは null） */
export type SessionUser = {
  userId: string
  displayName: string
  /** チーム作成権限を持つか（ENV の許可 Discord ID） */
  canCreateTeam: boolean
}
