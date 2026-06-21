/**
 * スクリム調整機能 - フロント/サーバー共通のドメイン型
 *
 * DBスキーマ（Drizzle / PostgreSQL）と対応するが、APIをまたぐJSONの形として
 * camelCase で定義する。サーバー側はこの型に合わせてレスポンスを組み立てる。
 */

/** 予定の状態。未回答は「行が無い」状態で表現するため、ここには含めない */
export type ScheduleStatus = "ok" | "maybe" | "ng"

/**
 * チーム内の権限ロール。権限は master ⊇ admin ⊇ member の包含関係。
 * - master: チーム・admin・member・自分を管理でき、master 権限を他人に譲渡できる（チームに必ず1人）
 * - admin:  member・チーム・自分を編集できる（複数可）
 * - member: 自分のことだけ編集できる（複数可）
 */
export type TeamRole = "master" | "admin" | "member"

/** admin 相当以上（master または admin）の管理権限を持つロールか。front/server 共通の判定 */
export const hasAdminAuthority = (role: TeamRole): boolean => role === "master" || role === "admin"

/**
 * チームの活動可否の管理方法。
 * - members: 各メンバーが予定を入力し、ok数 >= requiredCount で活動可能
 * - team:    admin がチーム単位で日別状態を入力（team_day_status）
 */
export type TeamManagementMode = "members" | "team"

/** requiredCount（活動可能と判定するのに必要な ok の人数）のデフォルト値 */
export const DEFAULT_REQUIRED_COUNT = 5
/** requiredCount の最小値（1人未満は不可。サーバー側 check 制約と一致） */
export const MIN_REQUIRED_COUNT = 1
/** requiredCount をユーザーに見せるときの表示ラベル（この用語で統一する） */
export const REQUIRED_COUNT_LABEL = "活動可能人数"

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
  /**
   * ログイン中ユーザーがこのチームに所属しているか。
   * 一覧取得（GET /teams）でのみ付与。作成/参加/更新の単体レスポンスでは未設定（undefined）。
   */
  isMember?: boolean
  /**
   * ログイン中ユーザーがこのチームの master か。
   * 一覧取得（GET /teams）でのみ付与。master はアカウント削除・脱退の可否判定に使う。
   */
  isMaster?: boolean
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

/**
 * 通知 Webhook の枠（#172）。
 * - own:    自分たち用サーバー
 * - shared: 相手も見る共有サーバー
 */
export type WebhookSlot = "own" | "shared"

/** Webhook の送信先サービス種別。今は Discord のみ（将来 "slack" 等を加算）。 */
export type WebhookProvider = "discord"

/** Webhook 枠の表示ラベル（この用語で統一する） */
export const WEBHOOK_SLOT_LABEL: Record<WebhookSlot, string> = {
  own: "自分たち用",
  shared: "相手も見るサーバー用",
}

/** 表示順を固定するための枠一覧 */
export const WEBHOOK_SLOTS: WebhookSlot[] = ["own", "shared"]

/**
 * Webhook 設定の取得結果（GET /webhooks）。閲覧権限で中身が変わる:
 * - master: 生の webhookUrl を含む（URL を読めるのは master のみ）。
 * - admin（非 master）: webhookUrl は null、maskedUrl に部分マスク（ドメイン+1文字）だけ入る。
 */
export type TeamWebhookView = {
  slot: WebhookSlot
  provider: WebhookProvider
  notifyActivityReached: boolean
  /** 設定済みか（URL を伏せても登録の有無は admin に見せる） */
  configured: boolean
  /** 生 URL。master のみ。admin/未設定では null */
  webhookUrl?: string | null
  /** 部分マスク済み URL（origin + パス先頭1文字）。admin の設定済み枠でのみ入る */
  maskedUrl?: string | null
}

/** Webhook 1枠ぶんの更新内容（PUT /webhooks）。webhookUrl は変更時のみ・トグルのみ更新も可 */
export type TeamWebhookSlotPatch = {
  provider?: WebhookProvider
  webhookUrl?: string
  notifyActivityReached?: boolean
}

/** ログイン中のユーザー（未ログインは null） */
export type SessionUser = {
  userId: string
  displayName: string
  /** チーム作成権限を持つか（ENV の許可 Discord ID） */
  canCreateTeam: boolean
}
