// スクリム調整機能 Drizzle スキーマ (PostgreSQL / Neon 想定)
// 設計の詳細は VIBES/plan/files/team-schedules-handoff.md を参照。
//
// 設計方針（"善意で直さない"ための明記）:
// - 未記入 = schedules に行が無い。status は ok / maybe / ng の3値のみ。
// - 状態系は ENUM ではなく text + 名前付き CHECK（後から値を増減しやすい）。
//   Drizzle の { enum } は TS型を絞るだけで、DB制約は作らない。
// - 集計・成立・詰みは DB に持たせず、必要範囲を SELECT してフロントで算出する。
//
// 注意: users.password_hash は認証方式が未決のため確定版のまま残している。
//       passwordless（Discord magic-link）が確定したら別マイグレーションで削除する。

import { sql } from "drizzle-orm"
import { pgTable, uuid, text, integer, boolean, date, timestamp, primaryKey, foreignKey, index, uniqueIndex, check } from "drizzle-orm/pg-core"

// teams: チーム（自チームも相手チームも全部ここに入れる）
export const teams = pgTable(
  "teams",
  {
    teamId: uuid("team_id").primaryKey().defaultRandom(), // gen_random_uuid() = UUIDv4
    name: text("name").notNull(),
    description: text("description"),
    // 「活動可能」と判定するのに必要な ok の人数。members モードで使う。team モードでは未使用
    requiredCount: integer("required_count").notNull().default(5),
    // 活動可否の管理方法:
    // - members: 各メンバーが schedules に入力 → ok数 >= required_count で活動可能
    // - team:    admin がチームとして team_day_status に入力（4状態）
    managementMode: text("management_mode", { enum: ["members", "team"] })
      .notNull()
      .default("members"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("teams_required_count_chk", sql`${t.requiredCount} >= 1`),
    check("teams_management_mode_chk", sql`${t.managementMode} in ('members', 'team')`),
  ],
)

// users: ログインする人（所属はここに持たせない＝複数チーム可）
export const users = pgTable("users", {
  userId: uuid("user_id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(), // 重複OK（ログインは一覧から選んで解決）
  passwordHash: text("password_hash").notNull(), // bcrypt。平文は入れない（認証方式が確定したら削除を検討）
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
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.userId] }),
    check("team_members_team_role_chk", sql`${t.teamRole} in ('master', 'admin', 'member')`),
    // master はチームに高々1人（部分ユニークインデックス）。「必ず1人必要」のうち上限を DB で担保し、
    // 下限（最低1人）は作成者を master にすることで成立させる（master 不在を作る操作は別途アプリ側で防ぐ）
    uniqueIndex("uq_team_members_one_master").on(t.teamId).where(sql`${t.teamRole} = 'master'`),
    index("idx_team_members_user").on(t.userId), // 「この人の所属チーム一覧」用
  ],
)

// schedules: 予定（1日1行）。未記入 = 行が無い。状態を付けた時だけ INSERT
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
// 未記入 = 行が無い。状態を付けた時だけ INSERT（schedules と同じ流儀）
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
  (t) => [
    primaryKey({ columns: [t.teamId, t.day] }),
    check("team_day_status_status_chk", sql`${t.status} in ('ok', 'maybe', 'ng')`),
  ],
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
