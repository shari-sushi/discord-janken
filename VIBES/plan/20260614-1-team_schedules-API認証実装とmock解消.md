# team_schedules サーバーAPI・認証実装と mock 解消

スクリム調整機能（`/team_schedules`）の残作業。DB基盤とクライアントUIは実装済みで、**サーバーサイドAPI・magic-link認証・Discordコマンドが未実装**、クライアントは API 未接続時に mock フォールバックで仮表示している状態。この計画でサーバーを実装し、mock を実データへ切り替える。

起点ドキュメント:

- [team-schedules-handoff.md](files/team-schedules-handoff.md)（設計の壁打ち）
- [20260613-1-team_schedules-DB-API実装計画.md](20260613-1-team_schedules-DB-API実装計画.md)（DB+API+認証の元計画。本計画はこの作業ステップ4〜9の続き）
- [schema.ts](files/schema.ts) / [schema.sql](files/schema.sql)

## 目的・背景

直近コミット「スクリム調整機能のDB基盤（PostgreSQL + Drizzle）を追加」までで以下が完了済み:

- 依存追加（drizzle-orm / @neondatabase/serverless / pg / drizzle-kit）
- Drizzle スキーマ・型・クライアント（`app/_domains/teamSchedules/_server/schema.ts`, `types.ts`, `app/_server/lib/db/index.ts`）
- `drizzle.config.ts` + マイグレーション（`drizzle/0000_init_team_schedules.sql`）
- `DATABASE_URL` を `env.ts` に追加
- クライアントUI一式（`app/team_schedules/`）と API契約クライアント（`teamSchedulesApiClient.ts`）

未完了は元計画の作業ステップ4〜9に相当する **サーバー側全部 + mock解消**。クライアントは `teamSchedulesApiClient` を叩く前提で組まれており、API失敗時のみ `buildMockData` にフォールバックする（`TeamSchedulesPage.tsx` の初期ロード `useEffect`）。よってサーバーを実装すれば自動的に実データに切り替わるが、mockフォールバック自体の扱いは要整理。

## 実装計画

### 1. 認証基盤（利用者セッション・既存とは完全分離）

元計画「セッション（権限ドメインの完全分離）」に従う。**既存 `app/_server/lib/session.ts`（開発者/管理者用）には触れない**（コメント追記のみ）。

- `app/_domains/teamSchedules/_server/session.ts`
  - Redisキー prefix `ts-session:`（キー空間を分離）
  - HttpOnly + Secure + SameSite=Lax Cookie `ts_session`
  - `createUserSession(userId)` / `getUserIdFromSession(request)` / `deleteUserSession(token)`
  - SessionData は `userId`(uuid) ベース
- `app/_domains/teamSchedules/_server/redisKeys.ts`
  - magic-link: `ts:magic:{token}`（TTL 600s・単回使用）
- `app/_domains/teamSchedules/_server/validators.ts`
  - status（ok/maybe/ng）・day（date文字列）・required_count 等のバリデーション/型ガード
- 認可ヘルパー（`_server/` 配下）
  - `getSessionUserId(request)`: Cookie → session → userId（未認証は null）
  - `assertTeamMember(teamId, userId)` / `assertTeamAdmin(teamId, userId)`: team_members を引いて role 判定
  - 秘匿が必要な場面は 404 を返す（coding-standards.md）

### 2. magic-link 検証エンドポイント

- `POST /api/web/team-schedules/auth/verify { token }`
  - Redis から token GET → 無ければ 401 → 即 DELETE（単回使用）
  - discord_links を discordUserId で検索。無ければ users + discord_links を INSERT（セルフサインアップ、display_name = Discordユーザー名）
  - セッション作成 → `ts_session` Cookie 設定
  - `{ success, user: { userId, displayName } }` を返す

### 3. Discord コマンド `team-schedule-login`

- `commands.ts` に `COMMANDS.TEAM_SCHEDULE.LOGIN = "team-schedule-login"` 追加
- `register.ts` にコマンド定義追加
- `route.ts` の switch に振り分け追加
- 実装ファイル `app/api/discord/command/team-schedule/login.ts`
  - interaction から discord user id / username 取得
  - ワンタイムトークン生成（randomBytes）→ Redis 保存（TTL 600s）
  - ephemeral 返信で URL `${APP_URL}/team_schedules?token={token}`（`flags: 64`）

### 4. CRUD エンドポイント（`app/api/web/team-schedules/`）

既存 Web API の作法（`NextResponse.json({ success, ... })`）に合わせる。クライアント `teamSchedulesApiClient.ts` の契約に一致させる:

| メソッド | パス | 認証 | 内容 |
| --- | --- | --- | --- |
| GET | `/session` | 不要(401で未ログイン) | ログイン中ユーザー |
| GET | `/teams` | 不要 | チーム一覧（比較セレクタ用） |
| GET | `/teams/[teamId]/schedule?from=&to=` | 不要 | 期間内 schedules + members（グリッド描画用） |
| PUT | `/teams/[teamId]/schedule` | 必要・本人列 | セル upsert（day/status/note） |
| DELETE | `/teams/[teamId]/schedule` | 必要・本人列 | セルを未記入に戻す（行DELETE） |

> クライアントが現状叩くのは上記5本。元計画にある teams作成・members管理・team更新系（POST/PATCH/DELETE members 等）は**本計画では後回し**（admin管理UIが未実装でクライアントから呼ばれないため）。実装する場合は別タスク化。

書き込みの原則（handoff 5章）:

- 未記入 = 行が無い。status付与で upsert、未記入化で DELETE。
- status は ok/maybe/ng の3値のみ。
- 編集は `(teamId, userId)` が team_members に存在する人のみ（複合FKでDBも保証）。個人は自分の userId の行だけ。

### 5. mock 解消（クライアント側）

`app/team_schedules/_components/TeamSchedulesPage.tsx`:

- API実装後は `fetchSession`/`fetchTeams`/`fetchTeamSchedule` が実データを返すため、実データに自動切替される。
- mockフォールバック（`buildMockData` / `usingMock` / 永続化スキップ分岐）の扱いを決める:
  - 案A: 完全削除し、エラーは「読み込み失敗」表示にする。
  - 案B: 開発用に残すが、本番では発火しないようにする。
- 初期チーム選択（`ownTeamId`/`opponentTeamIds`）の決め方を実データ向けに見直す（mockでは "own"/"opp-a"/"opp-b" 固定）。
- ログイン後のリダイレクト着地（`?token=` を検出して `auth/verify` を叩く処理）が `LoginModal` または page にあるか確認し、無ければ実装。

### 6. テスト

- 規約: テストタイトルに `success:` / `failure:` プレフィックス、vitest。
- 認可（本人列のみ編集可・非メンバーは404）、magic-link（期限切れ/使用済みで401・単回使用）、status バリデーションを重点的に。

## 技術選定

元計画「技術選定」に準拠（変更なし）。Drizzle ORM / 本番 `@neondatabase/serverless`・ローカル `pg` 自動切替 / Redis（magic-link・セッション）/ HttpOnly Cookie。

## 留意点・落とし穴

- **セッション共用禁止**: `SessionData` 共用・`validateSession` 拡張は禁止。共用すると magic-link ログインの一般ユーザーが開発者用 Redis CRUD 管理UI を突破できる（元計画のセキュリティ理由）。
- **Discord snowflake** は text 保存。
- **3秒以内応答**: login コマンドはトークン生成+ephemeral返信のみで軽量。
- **CLAUDE.md のパス表記**: 文書は `app/domains/` だが実体は `app/_domains/`。
- コーディング終了時: `npm run lint` + `npx tsc --noEmit`。env を変えたら `setup.md` を対応。

## 作業ステップ（推奨順）

1. 認証基盤（session.ts / redisKeys.ts / validators.ts / 認可ヘルパー）
2. magic-link `auth/verify` エンドポイント
3. Discord コマンド `team-schedule-login`（commands/register/route/login.ts）
4. public read GET（session / teams / schedule）
5. write系（schedule upsert / delete）
6. mock 解消 + ログイン着地処理
7. テスト + lint + tsc

## 本計画では扱わない

- teams作成・members管理・team更新系API（admin管理UI未実装のため別タスク）
- グリッドUIの追加機能（成立列統合・モバイル幅・将来拡張）
- Neon プロビジョニング・接続文字列発行（インフラ別作業）
