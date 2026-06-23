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

/**
 * 1ユーザーが参加できるチーム数の上限（master として作成したチームも1つとして数える）。
 * 上限に達したユーザーは作成・参加ともに不可。ENV 許可リストのユーザーのみこの上限を無視できる。
 * 今後、有料プランで解放予定。サーバー（enforce）／クライアント（UX の出し分け）の両方で使う。
 */
export const MAX_TEAMS_PER_USER = 2

/**
 * 参加上限に達したときの案内文言（アップセル含む）。上限数は MAX_TEAMS_PER_USER から差し込むため、
 * 定数を変えれば文言の数値も自動で追従する（表示と実挙動の食い違いを防ぐ）。
 * 作成 API は "create"、参加 API は "join" を渡す（末尾の助詞が変わる）。フロント/サーバー共通。
 */
export const teamLimitMessage = (action: "create" | "join"): string => {
  const tail = action === "create" ? "新しいチームを作成できません" : "新しいチームに参加できません"
  return `参加できるチームは${MAX_TEAMS_PER_USER}つまでです。上限に達しているため${tail}。今後、有料プランでの上限解放を予定しています。`
}

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
  /**
   * このチームがスケジュールを相互共有している相手チームの teamId 一覧（#175）。
   * 一覧取得（GET /teams）でのみ付与。比較セレクタの相手候補と設定の共有解除一覧に使う。
   * 共有0件のチームでは空配列。作成/参加/更新の単体レスポンスでは未設定（undefined）。
   */
  sharedTeamIds?: string[]
}

/**
 * 共有リンク着地時の確認画面に出す情報（GET /shares/preview・#175）。
 * - sourceTeam: リンクを発行した（共有を申し込む）側のチーム
 * - acceptCandidates: 受諾者が admin 以上で結べる自分の所属チーム（sourceTeam 自身は除外）
 */
export type SharePreview = {
  sourceTeam: { teamId: string; name: string }
  acceptCandidates: { teamId: string; name: string }[]
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
 * - admin（非 master）: webhookUrl は null、maskedUrl に部分マスク（webhook id の先頭2文字まで）だけ入る。
 */
export type TeamWebhookView = {
  slot: WebhookSlot
  provider: WebhookProvider
  notifyActivityReached: boolean
  /** 設定済みか（URL を伏せても登録の有無は admin に見せる） */
  configured: boolean
  /** 生 URL。master のみ。admin/未設定では null */
  webhookUrl?: string | null
  /** 部分マスク済み URL（origin + /api/webhooks/ + id 先頭2文字）。admin の設定済み枠でのみ入る */
  maskedUrl?: string | null
}

/** Webhook 1枠ぶんの更新内容（PUT /webhooks）。webhookUrl は変更時のみ・トグルのみ更新も可 */
export type TeamWebhookSlotPatch = {
  provider?: WebhookProvider
  webhookUrl?: string
  notifyActivityReached?: boolean
}

/**
 * 通知設定の取得結果（GET /webhooks）。Webhook 枠（#172）＋送信時刻（#177）。
 * notifyTime: "HH:MM"(JST) なら指定時刻に通知 / null なら活動可能になり次第すぐ通知。
 */
export type TeamWebhookSettings = {
  webhooks: TeamWebhookView[]
  notifyTime: string | null
}

/**
 * 通知設定の更新内容（PUT /webhooks）。枠ごとの patch（own/shared）に加え、送信時刻を載せられる。
 * notifyTime: "HH:MM"=時刻指定 / null=即時に戻す / 省略（キー無し）=触らない。
 */
export type TeamWebhooksUpdate = Partial<Record<WebhookSlot, TeamWebhookSlotPatch | null>> & {
  notifyTime?: string | null
}

/** ログイン中のユーザー（未ログインは null） */
export type SessionUser = {
  userId: string
  displayName: string
  /**
   * チーム数の上限（MAX_TEAMS_PER_USER）を無視できる許可ユーザーか（ENV の許可 Discord ID）。
   * 通常ユーザーは false。フロントは所属チーム数と組み合わせて作成・参加の可否をリアクティブに算出する。
   */
  bypassTeamLimit: boolean
}

// ───────────────────────────────────────────────────────────
// 管理画面（開発者用 /developers/team-schedules）専用の型（#166）
// admin 認証済みのため Discord ID / suspended を含めてよい
// （通常の利用者 API では返さない方針を維持する）。
// ───────────────────────────────────────────────────────────

/** 管理画面に表示するチームメンバー（Discord ID・suspended 含む） */
export type AdminTeamMember = {
  userId: string
  displayName: string
  teamRole: TeamRole
  /** 利用停止中か */
  suspended: boolean
  /** このユーザーに紐づく Discord ID（0件以上） */
  discordUserIds: string[]
  roles: LolRoleFlags
}

/** 管理画面に表示するチーム（設定＋メンバー一覧） */
export type AdminTeam = {
  teamId: string
  name: string
  description: string | null
  requiredCount: number
  managementMode: TeamManagementMode
  /** 作成日時（ISO8601 文字列） */
  createdAt: string
  members: AdminTeamMember[]
}

/** どのチームにも所属していないユーザー（掃除対象の候補） */
export type AdminOrphanUser = {
  userId: string
  displayName: string
  suspended: boolean
  discordUserIds: string[]
  /** 作成日時（ISO8601 文字列） */
  createdAt: string
}

/** 管理画面に表示する共有ペア（#175）。team_shares 1行 = 1ペア（team_low < team_high） */
export type AdminShare = {
  teamLow: { teamId: string; name: string }
  teamHigh: { teamId: string; name: string }
  /** 成立日時（ISO8601 文字列） */
  createdAt: string
}

/** GET /admin/overview のレスポンス本体 */
export type AdminOverview = {
  teams: AdminTeam[]
  orphanUsers: AdminOrphanUser[]
  /** チーム間スケジュール共有のペア一覧（#175） */
  shares: AdminShare[]
}

/** Discord BAN 1件 */
export type AdminDiscordBan = {
  discordUserId: string
  reason: string | null
  /** BAN 日時（ISO8601 文字列） */
  bannedAt: string
}
