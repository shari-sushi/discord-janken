// スクリム調整機能 Drizzle スキーマ (PostgreSQL / Neon 想定)
// 設計の詳細は VIBES/plan/files/team-schedules-handoff.md を参照。
//
// 設計方針（"善意で直さない"ための明記）:
// - 未回答 = schedules に行が無い。status は ok / maybe / ng の3値のみ。
// - 状態系は ENUM ではなく text + 名前付き CHECK（後から値を増減しやすい）。
//   Drizzle の { enum } は TS型を絞るだけで、DB制約は作らない。
// - 集計・成立・詰みは DB に持たせず、必要範囲を SELECT してフロントで算出する。
//
// 注意: users.password_hash は認証方式が未決のため確定版のまま残している。
//       passwordless（Discord magic-link）が確定したら別マイグレーションで削除する。

import { sql } from "drizzle-orm"
import { pgTable, uuid, text, integer, boolean, date, timestamp, primaryKey, foreignKey, index, uniqueIndex, check } from "drizzle-orm/pg-core"
import { DEFAULT_REQUIRED_COUNT } from "../types"

// teams: チーム（自チームも相手チームも全部ここに入れる）
export const teams = pgTable(
  "teams",
  {
    teamId: uuid("team_id").primaryKey().defaultRandom(), // gen_random_uuid() = UUIDv4
    name: text("name").notNull(),
    description: text("description"),
    // 「活動可能」と判定するのに必要な ok の人数。members モードで使う。team モードでは未使用
    requiredCount: integer("required_count").notNull().default(DEFAULT_REQUIRED_COUNT),
    // 活動可否の管理方法:
    // - members: 各メンバーが schedules に入力 → ok数 >= required_count で活動可能
    // - team:    admin がチームとして team_day_status に入力（4状態）
    managementMode: text("management_mode", { enum: ["members", "team"] })
      .notNull()
      .default("members"),
    // 活動可能通知の送信時刻（#177）。"HH:MM"（JST）の文字列 or null。
    // - null:   即時通知（活動可能になった立ち上がりエッジで送る。#172 の挙動）
    // - "HH:MM": その日の指定時刻(JST)に送る（QStash 単発ジョブで予約し、発火時に再判定）
    // date/note と同じく「文字列で TZ 事故回避」の流儀。形式はアプリ側 validator(isHhmm) で検証する。
    notifyActivityTime: text("notify_activity_time"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("teams_required_count_chk", sql`${t.requiredCount} >= 1`), check("teams_management_mode_chk", sql`${t.managementMode} in ('members', 'team')`)],
)

// users: ログインする人（所属はここに持たせない＝複数チーム可）
export const users = pgTable("users", {
  userId: uuid("user_id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(), // 重複OK（ログインは一覧から選んで解決）
  passwordHash: text("password_hash").notNull(), // bcrypt。平文は入れない（認証方式が確定したら削除を検討）
  // 利用停止フラグ（#166）。true の間は書き込み系 API が 403 を返す（読み取りは透過）。解除可能。
  // 既ログインユーザーへの即時失効はせず、新規操作の遮断のみ（管理画面の運用手段）。
  suspended: boolean("suspended").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

// team_members: 所属(M:N) + ロール。相手adminは A/B 両方に admin で入れる
export const teamMembers = pgTable(
  "team_members",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.teamId, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    // アプリ内の権限ロール（master / admin / member）。権限は master ⊇ admin ⊇ member。{enum} で TS型も絞る
    teamRole: text("team_role", { enum: ["master", "admin", "member"] })
      .notNull()
      .default("member"),
    // このチームで担当できる LoL ロール（can-play の有無）。固定5種なので bool 5列
    top: boolean("top").notNull().default(false),
    jungle: boolean("jungle").notNull().default(false),
    mid: boolean("mid").notNull().default(false),
    adc: boolean("adc").notNull().default(false),
    support: boolean("support").notNull().default(false),
    // 招待リンク経由で参加した場合の発行者（#108: 誰のリンクで入ったかの記録）。
    // master 直接作成・手動追加・発行者不明では null。発行者アカウント削除時は記録を残して null 化。
    invitedBy: uuid("invited_by").references(() => users.userId, { onDelete: "set null" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.userId] }),
    check("team_members_team_role_chk", sql`${t.teamRole} in ('master', 'admin', 'member')`),
    // master はチームに高々1人（部分ユニークインデックス）。「必ず1人必要」のうち上限を DB で担保し、
    // 下限（最低1人）は作成者を master にすることで成立させる（master 不在を作る操作は別途アプリ側で防ぐ）
    uniqueIndex("uq_team_members_one_master")
      .on(t.teamId)
      .where(sql`${t.teamRole} = 'master'`),
    index("idx_team_members_user").on(t.userId), // 「この人の所属チーム一覧」用
  ],
)

// schedules: 予定（1日1行）。未回答 = 行が無い。状態を付けた時だけ INSERT
export const schedules = pgTable(
  "schedules",
  {
    teamId: uuid("team_id").notNull(),
    userId: uuid("user_id").notNull(),
    // date は既定で string("2026-06-16") で返る。カレンダー日付なので string 推奨（TZ事故回避）
    day: date("day").notNull(),
    status: text("status", { enum: ["ok", "maybe", "ng"] }).notNull(),
    note: text("note"), // 自由記入の時間/コメント (例: "21:00~")
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.userId, t.day] }),
    // (team_id, user_id) を team_members へ複合FK = 所属してない人の行を作らせない
    foreignKey({
      columns: [t.teamId, t.userId],
      foreignColumns: [teamMembers.teamId, teamMembers.userId],
      name: "schedules_team_member_fk",
    }).onDelete("cascade"),
    check("schedules_status_chk", sql`${t.status} in ('ok', 'maybe', 'ng')`),
    index("idx_schedules_team_day").on(t.teamId, t.day), // 集計クエリ用
  ],
)

// team_day_status: チーム単位モード（management_mode='team'）の日別状態。1チーム1日1行
// 未回答 = 行が無い。状態を付けた時だけ INSERT（schedules と同じ流儀）
export const teamDayStatus = pgTable(
  "team_day_status",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.teamId, { onDelete: "cascade" }),
    day: date("day").notNull(),
    status: text("status", { enum: ["ok", "maybe", "ng"] }).notNull(),
    note: text("note"), // 自由記入の時間/コメント
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.day] }), check("team_day_status_status_chk", sql`${t.status} in ('ok', 'maybe', 'ng')`)],
)

// team_webhooks: チームの通知先 Webhook（1枠1行）。#172 活動可能通知の送信先。
// - slot: own=自分たち用 / shared=相手も見るサーバー用。1チーム1枠1行（行が存在=設定済み）。
// - provider: その URL が何のサービス向けか。いまは Discord 専用だが、テーブル名を汎用に保ち
//   将来 Slack 等を加算的に足せるよう discriminator 列を最初から持つ。CHECK は 'discord' のみに絞り、
//   未対応のものを許可しない（拡張時に CHECK 値・ペイロード整形・検証・UI を加算する）。
// - notifyActivityReached: 「活動可能になった」通知の ON/OFF（今はこの1イベントのみ）。
export const teamWebhooks = pgTable(
  "team_webhooks",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.teamId, { onDelete: "cascade" }),
    slot: text("slot", { enum: ["own", "shared"] }).notNull(),
    provider: text("provider", { enum: ["discord"] }).notNull().default("discord"),
    webhookUrl: text("webhook_url").notNull(),
    notifyActivityReached: boolean("notify_activity_reached").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.slot] }),
    check("team_webhooks_slot_chk", sql`${t.slot} in ('own', 'shared')`),
    check("team_webhooks_provider_chk", sql`${t.provider} in ('discord')`),
  ],
)

// schedule_notifications: 活動可能通知の重複送信防止マーカー（エッジトリガの latch）。
// 行の存在/不在が「その日の通知を送ったか」の状態。notified_at は送信時刻のメモ。
// 達成の立ち上がりで INSERT（送信）、谷に落ちたら DELETE（再武装）。詳細は notify.ts。
export const scheduleNotifications = pgTable(
  "schedule_notifications",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.teamId, { onDelete: "cascade" }),
    day: date("day").notNull(),
    // 将来イベント種別が増えたときの判別。今は activity_reached のみ
    kind: text("kind").notNull().default("activity_reached"),
    notifiedAt: timestamp("notified_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.day, t.kind] })],
)

// discord_links: 1アプリアカウント : N Discordアカウント（認証の背骨）
export const discordLinks = pgTable(
  "discord_links",
  {
    discordUserId: text("discord_user_id").primaryKey(), // Discordのsnowflake。text で持つのが安全
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_discord_links_user").on(t.userId)],
)

// discord_bans: magic-link ログイン/サインアップを遮断する Discord ID のブラックリスト（#166）
// auth/verify（新規ログイン時）でのみ判定する。既に ts_session を持つユーザーの即時失効は将来対応。
export const discordBans = pgTable("discord_bans", {
  discordUserId: text("discord_user_id").primaryKey(), // Discordのsnowflake。discord_links とは独立（FKは張らない）
  reason: text("reason"), // BAN 理由（任意・運用メモ）
  bannedAt: timestamp("banned_at", { withTimezone: true }).notNull().defaultNow(),
})

// 推論される型（クエリ結果や INSERT 値に効く）
export type Team = typeof teams.$inferSelect
export type NewTeam = typeof teams.$inferInsert
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type TeamMember = typeof teamMembers.$inferSelect
export type NewTeamMember = typeof teamMembers.$inferInsert
export type Schedule = typeof schedules.$inferSelect
export type NewSchedule = typeof schedules.$inferInsert
export type TeamDayStatus = typeof teamDayStatus.$inferSelect
export type NewTeamDayStatus = typeof teamDayStatus.$inferInsert
export type DiscordLink = typeof discordLinks.$inferSelect
export type NewDiscordLink = typeof discordLinks.$inferInsert
export type TeamWebhook = typeof teamWebhooks.$inferSelect
export type NewTeamWebhook = typeof teamWebhooks.$inferInsert
export type ScheduleNotification = typeof scheduleNotifications.$inferSelect
export type NewScheduleNotification = typeof scheduleNotifications.$inferInsert
export type DiscordBan = typeof discordBans.$inferSelect
export type NewDiscordBan = typeof discordBans.$inferInsert
