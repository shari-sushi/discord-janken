# team_schedules 引き継ぎドキュメント

discord-janken リポジトリに「スクリム調整」機能を1機能として追加する。設計の壁打ちで決まった事項・設計意図・未決事項をまとめたもの。`[決定]` / `[推奨]` / `[未決]` のタグで状態を区別している。Claude Code はこれを起点に実装を進めてよい。**`[未決]` は本人確認が必要なので、勝手に確定させず、実装前に確認すること。**

## 1. 概要

LoL のサークルで使うスクリム（練習試合）日程調整 Web アプリ。

- `[決定]` 既存リポジトリ **discord-janken の1機能**として統合する。独立アプリにはしない。
- `[決定]` パスは `/team_schedules`。**単一ページ・ページ遷移なし**。
- `[決定]` スタック：Next.js（フルスタック）+ TailwindCSS + TanStack Table、Vercel デプロイ。
- `[決定]` DB は **PostgreSQL（Neon 想定）+ Drizzle ORM**。
  - 注意：discord-janken は現状 Redis 利用。本機能で **Postgres を追加** → Redis と Postgres の併用になる。
  - Redis は「認証トークン / セッション」の短命データに使う（後述）。**集計のキャッシュには使わない**。

## 2. ドメイン / 要件（構造B）

スクリムは「自チーム」と「相手チーム」のマッチング。

- **自チーム**：メンバー各自が予定を入力。`ok` が `required_count`（既定5）人以上の日を「活動可能」とする。
- **相手サークル**：チーム単位。Aチーム / Bチームがある。相手側が自分で記入する。
- **成立日**：自チームが活動可能 **かつ** 相手チームも活動可能な同じ日。
- `[決定]` **マッチングは保存しない**。比較するチーム（自+相手）を実行時に選んで都度算出する。固定の「board」は作らない（「照らし合わせるパターンを自由に」のため）。

### 統一モデル（重要な設計意図）

`[決定]` 相手チームも `teams` の1チームとして扱う。

- 相手チーム = `required_count = 1` で、**代表メンバー1人（＝相手admin）** を持つチーム。
- 相手admin は相手Aと相手Bの **両方に member(admin) として所属**する。これで「1アカウントでA/B両方を編集」が権限の特別扱いなしに成立する。
- 結果、「チームが活動可能か」は全チーム共通で `COUNT(status='ok') >= required_count` で判定できる（自=5, 相手=1）。

## 3. 権限 / 公開範囲

- `[決定]` ロールは2種類：`individual`（個人）/ `admin`（チーム管理者）。`team_members.team_role` に持つ。
- `[決定]` **閲覧は誰でも可**（未認証OK・public read）。
- `[決定]` **書き込み時に未認証ならログインモーダルを出す**。
- 個人は自分の列（自分の schedules 行）だけ編集可。admin はチーム作成・メンバー追加・期間設定など。

## 4. 認証（passwordless / Discord magic-link）

`[決定]` OAuth は使わない（責任を負いたくない）。**Discord bot の magic-link** でログインする。

フロー：

1. ユーザーが Discord で `/team_schedule_login` を実行。
2. bot は interaction から Discord user ID を取得 → `discord_links` で対応するアプリアカウントを解決。
3. ワンタイム・短命・単回使用のトークンを生成し、**認証付きURLを ephemeral 返信**（本人だけに見える）。
4. ユーザーがリンクをクリック → Web 側でトークン検証 → セッション確立 → `/team_schedules` にログイン状態で着地。

実装の推奨：

- `[推奨]` トークンは **Redis に TTL付き（10分程度）** で保存、使用時に DELETE（単回使用）。← Redis の適所。discord-janken に既にある Redis をそのまま使える。
- `[推奨]` セッションは **HttpOnly + Secure cookie**。
- `[決定]` `discord_links` が認証の背骨（Discord ID → アプリアカウント、1アプリ:N Discord）。
- `[推奨]` passwordless にするので **`users.password_hash` は削除**する（下のスキーマにはまだ残してある。確定したら消す）。

UX上の含意：

- 「書き込み→ログインモーダル」のモーダルは入力フォームではなく、**「Discord で `/team_schedule_login` を実行してリンクを踏んで」という案内**になる。初回だけ Discord へ往復、以降は cookie セッションで書き込みはスルー。

## 5. データモデル

### 設計方針（Claude Code が"善意で直さない"よう明記）

- `[決定]` **未記入 = schedules に行が無い**。`status` は `ok / maybe / ng` の3値のみ。状態を付けた時だけ INSERT、未記入に戻したら DELETE。
- `[決定]` 状態系の値は **ENUM ではなく text + CHECK**（後から値を増減しやすい）。CHECK制約には名前を付ける。
- `[決定]` Drizzle 側は `text(col, { enum: [...] })` で **TS型だけ**リテラルユニオンに絞る（DBはtext+CHECKのまま。`{enum}` はDB制約を作らない、純粋にTS型ヒント）。
- `[決定]` `schedules` は複合PK `(team_id, user_id, day)`、`(team_id, user_id)` を `team_members` へ複合FK（所属してない人の行を作らせない）。
- `[決定]` `day` は `date` 型（年月日のみ・時刻なし）。スクリム開始時刻は自由記入の `note` に文字で持つ。
- `[決定]` `kind` 列（自/相手フラグ）は **作らない**。自/相手は相対的な関係なので、ログインユーザーがそのチームの member かどうかで判断する。
- `[決定]` LoLロールの「やる/やらない」は `team_members` に **bool 5列**（top/jungle/mid/adc/support）。チームごとに変わるので所属単位で持つ。

### Drizzle スキーマ（現状の確定版）

```ts
// drizzle-orm / drizzle-kit 前提。最新APIは https://orm.drizzle.team で確認。
// テーブル定義の第2引数は「配列を返す」形（現行）。古い Drizzle はオブジェクト返しなので注意。
import { sql } from "drizzle-orm";
import {
  pgTable, uuid, text, integer, boolean, date, timestamp,
  primaryKey, foreignKey, index, check,
} from "drizzle-orm/pg-core";

// teams: チーム（自チームも相手チームも全部ここ）
export const teams = pgTable(
  "teams",
  {
    teamId: uuid("team_id").primaryKey().defaultRandom(), // gen_random_uuid() = UUIDv4
    name: text("name").notNull(),
    description: text("description"),
    requiredCount: integer("required_count").notNull().default(5), // 自=5, 相手=1
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("teams_required_count_chk", sql`${t.requiredCount} >= 1`)]
);

// users: ログインする人（所属はここに持たせない＝複数チーム可）
export const users = pgTable("users", {
  userId: uuid("user_id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(), // 重複OK
  // ↓ passwordless(Discord magic-link)に移行方針。確定したら削除（[未決]）
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// team_members: 所属(M:N) + ロール。相手adminは A/B 両方に admin で入れる
export const teamMembers = pgTable(
  "team_members",
  {
    teamId: uuid("team_id").notNull().references(() => teams.teamId, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.userId, { onDelete: "cascade" }),
    teamRole: text("team_role", { enum: ["individual", "admin"] }).notNull().default("individual"),
    // このチームで担当できるLoLロール（can-play の有無）
    top: boolean("top").notNull().default(false),
    jungle: boolean("jungle").notNull().default(false),
    mid: boolean("mid").notNull().default(false),
    adc: boolean("adc").notNull().default(false),
    support: boolean("support").notNull().default(false),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.userId] }),
    check("team_members_team_role_chk", sql`${t.teamRole} in ('individual', 'admin')`),
    index("idx_team_members_user").on(t.userId),
  ]
);

// schedules: 予定（1日1行）。未記入 = 行が無い
export const schedules = pgTable(
  "schedules",
  {
    teamId: uuid("team_id").notNull(),
    userId: uuid("user_id").notNull(),
    day: date("day").notNull(), // 既定で string("2026-06-16")。時刻は持たない
    status: text("status", { enum: ["ok", "maybe", "ng"] }).notNull(),
    note: text("note"), // 自由記入の時間/コメント
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.userId, t.day] }),
    foreignKey({
      columns: [t.teamId, t.userId],
      foreignColumns: [teamMembers.teamId, teamMembers.userId],
      name: "schedules_team_member_fk",
    }).onDelete("cascade"),
    check("schedules_status_chk", sql`${t.status} in ('ok', 'maybe', 'ng')`),
    index("idx_schedules_team_day").on(t.teamId, t.day),
  ]
);

// discord_links: 1アプリアカウント : N Discord（認証の背骨）
export const discordLinks = pgTable(
  "discord_links",
  {
    discordUserId: text("discord_user_id").primaryKey(), // snowflakeはtext
    userId: uuid("user_id").notNull().references(() => users.userId, { onDelete: "cascade" }),
    linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_discord_links_user").on(t.userId)]
);

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type User = typeof users.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;
export type DiscordLink = typeof discordLinks.$inferSelect;
```

### 集計・成立・詰み（すべてフロントで算出）

DB は生データの保存だけ。必要範囲を SELECT して、以下はクライアントで計算する。

- **○数** = そのチーム・その日の `status='ok'` の数。
- **成立** = 自チームの ok数 >= `required_count` **かつ** 相手チームが活動可能（同じ日）。
- **詰み（行を薄く）** = `(所属人数 - ng数) < required_count`。所属人数は `team_members` から取る（未記入は行が無いので schedules の件数では数えられない）。

## 6. UI / 画面

`/team_schedules` の単一ページに、調整さん型グリッドを表示。**動くモックを `scrim-grid-mock.jsx` として別途用意済み**（React+Tailwind。挙動の参照に使う。本番は TanStack Table で実装）。

グリッド仕様：

- `[決定]` 行 = 日付、列 = メンバー（調整さん型）。
- `[決定]` セルは **4状態**：未記入(–) → ok(○) → maybe(△=検討中) → ng(×) をタップで循環。**デフォルト未記入**。各セルに **時間の自由記入欄**（free text）。
- `[決定]` 列順は **日付 → ○数 → 相手A → 相手B → 成立 → 自チーム各メンバー**。左の5列（日付〜成立）を **左固定（sticky / TanStack の column pinning）**。メンバー列は右に横スクロール。
- `[決定]` **自チームの詰みの日 → 行を `opacity-70`**。
- `[決定]` **相手チームの ng セル → そのセルだけ薄く**（相手が出せる日を見やすく）。
- `[決定]` 編集中の自分の列はハイライト。`required_count`（閾値）はチーム設定で可変。
- `[未決]` 「成立」を日付列に統合するか（本人が「あとで考える」と保留）。
- `[未決]` モバイル（Galaxy S20）で左固定5列の合計幅が広く、メンバー列が窮屈。幅削る / 相手A/Bを1列に畳む等は要検討。

画面フロー：

- public read：ロード時に対象チームの schedules を取得してグリッド描画。
- `[要設計]` 比較するチーム（自+相手）を選ぶ **in-page セレクタ**が要る（マッチングは選んだチーム対で算出するため）。
- write：未認証なら magic-link 案内モーダル → Discord で `/team_schedule_login` → リンク着地でセッション確立。

## 7. 採用しなかった / 保留した判断（理由つき・蒸し返さないため）

- **Redis を集計キャッシュに使う**：不要（規模が小さく早すぎる最適化）。実測でボトルネックが出たら read-through cache を検討。
- **DB の VIEW / MATERIALIZED VIEW**：不要（フロントがどのみち生の行を持つので二重作業）。
- **`kind` 列**：削除（自/相手は相対的でメンバーシップで判断可能）。
- **固定の board テーブル / 対戦カード(matchups) の保存**：今は不要（実行時に teamId を2つ選ぶだけ）。定番カードを保存したくなったら別途 `matchups(team_a_id, team_b_id)`。
- **ENUM 型**：使わず text + CHECK（値の増減のしやすさ優先）。

## 8. 技術メモ / 落とし穴

- **Vercel + Postgres**：従来のTCP接続ドライバはサーバーレスでコネクション枯渇しがち。`@neondatabase/serverless`（HTTPベース）か PgBouncer 等のプーラ前提で。Vercel のストレージ提供形態は変わるので採用時に最新を確認。
- **Drizzle の CHECK 出力**：バージョンによっては schema の `check()` がマイグレーションSQLに出ないことがある。`drizzle-kit generate` で出た SQL に `CONSTRAINT ... CHECK` が入っているか目視確認。無ければ手で足す。
- **gen_random_uuid()** は PostgreSQL 13+ で標準（pgcrypto 不要）。時系列ソートが欲しくなったら UUIDv7（RFC 9562）も選択肢。アカウントIDは v4 で十分。
- **Discord ID（snowflake）** は `text` で保存（数値オーバーフロー回避）。
- **bcrypt（もし password を復活させる場合）**：Vercel ではネイティブ `bcrypt` がビルドで詰まりがち。`bcryptjs` か `@node-rs/bcrypt`。72バイト超は切り捨てられる点に注意。

## 9. 未決事項（実装前に本人確認）

1. **passwordless 確定**：`users.password_hash` を削除していいか。
2. **初回ひも付け（bootstrapping）**：Discord アカウント→アプリアカウントの最初の紐付けを、(a) admin がメンバー追加時に Discord ID も登録 / (b) 本人が claim コード・招待リンクで自己紐付け、のどちらにするか。これが無いと login が誰のアカウントか解決できない。
3. **相手admin の認証**：相手サークルは自分の Discord/bot に居ない可能性。bot magic-link が届かないので、admin が発行する**汎用 magic-link（トークンのみ・パスワード不要）**を相手に渡す逃げ道を用意するか。
4. **ログインモーダルの UX**：上記4節の「Discordへ往復」フローで許容できるか。
5. **成立列の日付列統合**（6節）。
6. **モバイルの固定列幅**（6節）。

## 10. 将来拡張（MVP外・すべて加算的に後付け可能）

- **ロールのメタ情報**：優先順 / 得意度 / レートは「やる/やらない(bool)」とは別concern。やるなら別テーブル `member_role_details(team_id, user_id, lol_role, priority, proficiency, rating, ...)`。本職（チーム参加時の初期値seed）もそこ or `users` 側に。
- **対戦カードの保存**（7節の matchups）。
- **Redis read-through cache**（実測でボトルネックが出たら）。
