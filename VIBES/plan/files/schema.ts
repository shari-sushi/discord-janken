// スクリム調整アプリ Drizzle スキーマ (PostgreSQL)
// drizzle-orm / drizzle-kit 前提。最新APIは https://orm.drizzle.team で確認を。
// ※ テーブル定義の第2引数は「配列を返す」形（現行）。かなり古い Drizzle は
//    オブジェクトを返す形だったので、バージョンに注意。

import { sql } from "drizzle-orm"
import { pgTable, uuid, text, integer, boolean, date, timestamp, primaryKey, foreignKey, index, check } from "drizzle-orm/pg-core"

// teams: チーム（自チームも相手チームも全部ここ）
export const teams = pgTable(
  "teams",
  {
    teamId: uuid("team_id").primaryKey().defaultRandom(), // gen_random_uuid() = UUIDv4
    name: text("name").notNull(),
    description: text("description"),
    // 「活動可能」に必要な ok の人数。自=5, 相手=1 を作成時に設定
    requiredCount: integer("required_count").notNull().default(5),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("teams_required_count_chk", sql`${t.requiredCount} >= 1`)],
)

// users: ログインする人（所属はここに持たせない＝複数チーム可）
export const users = pgTable("users", {
  userId: uuid("user_id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(), // 重複OK
  passwordHash: text("password_hash").notNull(), // bcrypt。平文は入れない
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
    // アプリ内の権限ロール（個人 / 管理者）。{enum} でTS型も絞る
    teamRole: text("team_role", { enum: ["individual", "admin"] })
      .notNull()
      .default("individual"),
    // このチームで担当できるLoLロール（can-play の有無）。固定5種なので bool 5列
    top: boolean("top").notNull().default(false),
    jungle: boolean("jungle").notNull().default(false),
    mid: boolean("mid").notNull().default(false),
    adc: boolean("adc").notNull().default(false),
    support: boolean("support").notNull().default(false),
    // ※ 優先順・得意度・レート等は別concern（行ごとに値を持つ）。やるなら将来
    //   member_role_details(team_id, user_id, lol_role, priority, proficiency, rating ...)
    //   を別テーブルで。本職(初期値seed)もそこ or users 側に後付け可能。
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.userId] }),
    check("team_members_team_role_chk", sql`${t.teamRole} in ('individual', 'admin')`),
    index("idx_team_members_user").on(t.userId), // 「この人の所属チーム一覧」用
  ],
)

// schedules: 予定（1日1行）。未回答 = 行が無い。状態を付けた時だけ INSERT
export const schedules = pgTable(
  "schedules",
  {
    teamId: uuid("team_id").notNull(),
    userId: uuid("user_id").notNull(),
    // date は既定で string("2026-06-16") で返る。Dateオブジェクトが欲しければ
    // date("day", { mode: "date" })。カレンダー日付なので string 推奨（TZ事故回避）
    day: date("day").notNull(),
    status: text("status", { enum: ["ok", "maybe", "ng"] }).notNull(),
    note: text("note"), // 自由記入の時間/コメント
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.userId, t.day] }),
    // (team_id, user_id) を team_members に複合FK = 所属してない人の行を作らせない
    foreignKey({
      columns: [t.teamId, t.userId],
      foreignColumns: [teamMembers.teamId, teamMembers.userId],
      name: "schedules_team_member_fk",
    }).onDelete("cascade"),
    check("schedules_status_chk", sql`${t.status} in ('ok', 'maybe', 'ng')`),
    index("idx_schedules_team_day").on(t.teamId, t.day), // 集計クエリ用
  ],
)

// discord_links: 1アプリアカウント : N Discord
export const discordLinks = pgTable(
  "discord_links",
  {
    discordUserId: text("discord_user_id").primaryKey(), // snowflakeはtextで安全に
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_discord_links_user").on(t.userId)],
)

// 推論される型（クエリ結果やINSERT値に効く）
export type Team = typeof teams.$inferSelect
export type NewTeam = typeof teams.$inferInsert
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type TeamMember = typeof teamMembers.$inferSelect
export type Schedule = typeof schedules.$inferSelect
export type NewSchedule = typeof schedules.$inferInsert
export type DiscordLink = typeof discordLinks.$inferSelect
