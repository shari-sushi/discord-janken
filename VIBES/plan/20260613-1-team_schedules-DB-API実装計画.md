# team_schedules DB + API 実装計画

スクリム調整機能（`/team_schedules`）の **サーバーサイド（DB + API + Discord magic-link 認証）** の実装計画。
クライアント（グリッドUI）と DB インフラ準備（Neon プロビジョニング）は**別セッション**で進行中のため、本計画には含めない。

起点ドキュメント: [team-schedules-handoff.md](files/team-schedules-handoff.md) / [schema.ts](files/schema.ts) / [schema.sql](files/schema.sql)

## 目的・背景

- discord-janken に Postgres（Neon 想定）+ Drizzle ORM を新規導入し、Redis と併用する。
  - **Postgres**: スクリムの永続データ（teams / users / team_members / schedules / discord_links）
  - **Redis**: magic-link ワンタイムトークン（TTL付き・単回使用）とセッション（既存 [session.ts](../../my-app/app/_server/lib/session.ts) 流用方針）
- 認証は OAuth を使わず、Discord bot の magic-link でログイン（passwordless）。
- 集計（○数・成立・詰み）は DB に持たせず、フロントで算出。API は生データの CRUD と認証のみを担う。

## 確定事項（壁打ち + 本セッションでの決定）

handoff 9章の未決事項について、本セッションで以下を確定：

1. **password_hash**: `NOT NULL` を外して **nullable で残す**（passwordless だが列は温存。将来のパスワード復活余地）。
2. **初回ひも付け（bootstrapping）**: **セルフサインアップ方式**。
   `/team_schedule_login` 実行時に該当 `discord_links` が無ければ `users` + `discord_links` を自動作成する（＝リンクを踏むことが実質会員登録）。`display_name` は Discord のユーザー名から取得。
3. **相手admin の認証**: 特別扱い不要。相手チームの admin も **この bot が参加している Discord サーバーに居る人**なので、通常の magic-link でログインできる。
   → handoff にあった「汎用 magic-link（トークンのみ）の逃げ道」は **作らない**。
4. **スコープ**: 本計画は DB + API + Discord 認証コマンドに集中（クライアント/インフラは別セッション）。

5. **Discord コマンド名**: handoff の `/team_schedule_login` を、本プロジェクトのコマンド規約（小文字+ハイフン）に合わせ **`team-schedule-login`** とする。
6. **チーム参加**: MVP は **admin がメンバー追加する方式のみ**（handoff通り）。本人の自由参加（self-join）は将来拡張に回す。セルフサインアップで作られた users はログイン済みだが、チームに追加されるまで schedule 編集はできない。

UI 系の未決（成立列の日付列統合・モバイル固定列幅）は本計画の対象外。

## 技術選定

| 項目 | 採用 | 備考 |
| --- | --- | --- |
| ORM | **Drizzle ORM** + drizzle-kit | handoff 決定事項 |
| Postgres ドライバ | 本番=**`@neondatabase/serverless`**（HTTP）/ ローカル=**`pg`**（TCP）の自動切替 | Vercel枯渇回避 + ローカルdocker対応。解説: [postgres-driver-http-vs-tcp.md](files/postgres-driver-http-vs-tcp.md) |
| マイグレーション | drizzle-kit `generate` で SQL 生成 → Neon に適用 | CHECK 制約が SQL に出るか目視確認（handoff 8章の落とし穴）。出なければ [schema.sql](files/schema.sql) を手で適用 |
| トークン/セッション | Redis（既存 [redis.ts](../../my-app/app/_server/lib/redis/redis.ts)） | magic-link は TTL 10分・単回使用 |
| Cookie | HttpOnly + Secure + SameSite=Lax | セッショントークン保持 |

## DB 実装

### 1. 依存追加

```bash
npm i drizzle-orm @neondatabase/serverless
npm i -D drizzle-kit
```

### 2. 環境変数

- `DATABASE_URL`（Neon の接続文字列）を追加。
  - [env.ts](../../my-app/app/_server/lib/env.ts) に `export const DATABASE_URL = getRequiredEnv("DATABASE_URL")` を追加
  - [.claude/rules/setup.md](../../.claude/rules/setup.md) の環境変数一覧にも追記（コーディング規約の必須対応）
  - Vercel の環境変数にも登録（別セッションのインフラ作業と連携）

### 3. ファイル配置（ドメイン規約に準拠）

ドメイン名 = `teamSchedules`（既存は `app/_domains/` 配下。CLAUDE.md の表記は `app/domains/` だが実体は `_domains`）。

```txt
app/_domains/teamSchedules/
├── types.ts                  # フロント/サーバー共通の型（Drizzleの$inferからのre-export含む）
└── _server/
    ├── schema.ts             # Drizzle スキーマ（files/schema.ts をベースに移設）
    ├── redisKeys.ts          # magic-link トークンキー生成（ts:magic:{token} 等）
    └── validators.ts         # status/day/required_count 等のバリデーション・型ガード

app/_server/lib/db/
└── drizzle.ts                # Drizzle クライアント singleton（redis.ts と同様の遅延初期化）

drizzle.config.ts             # プロジェクトルート（my-app/）に配置
```

### 4. スキーマ調整（files/schema.ts からの差分）

- `users.passwordHash`: `text("password_hash")` から `.notNull()` を**外す**（nullable）。コメントを passwordless 方針に更新。
- それ以外は [files/schema.ts](files/schema.ts) のまま採用（teams / team_members / schedules / discord_links、複合PK・複合FK・CHECK・index）。
- `$inferSelect` / `$inferInsert` 型を `types.ts` に re-export してフロントと共有。

### 5. drizzle クライアント

`drizzle.ts` は `@neondatabase/serverless` の `neon(DATABASE_URL)` を `drizzle()` でラップ。redis.ts と同様に singleton 化。

## API 実装

すべて `app/api/web/team-schedules/` 配下。既存 Web API の作法（`NextResponse.json({ success, ... })`、認証ヘッダ/セッション検証）に合わせる。

### 認証フロー（magic-link）

```txt
1. Discord で /team_schedule_login 実行
2. bot handler:
   - interaction から discord user id / username を取得
   - ワンタイムトークン生成（randomBytes）
   - Redis に保存: key=ts:magic:{token}, value={discordUserId, discordUsername}, TTL=600s
   - ephemeral 返信で URL: ${APP_URL}/team_schedules?token={token}
3. ユーザーがリンクをクリック → /team_schedules がロード時に token を検出
4. フロント → POST /api/web/team-schedules/auth/verify { token }
   - Redis から token を GET → 無ければ 401（期限切れ/使用済み）
   - 即 DELETE（単回使用）
   - discord_links を discordUserId で検索:
       - あればその user_id を解決
       - 無ければ users を INSERT（display_name=discordUsername）+ discord_links INSERT（セルフサインアップ）
   - セッション作成（userId 紐付け）→ HttpOnly Cookie 設定
   - { success, user: { userId, displayName } } を返す
5. 以降の書き込みは Cookie セッションで認証
```

### セッション（権限ドメインの完全分離）

既存 [session.ts](../../my-app/app/_server/lib/session.ts) + [auth.ts](../../my-app/app/_server/lib/auth.ts) は **アプリ開発者/管理者専用の認証**である（`ALLOWED_USERS` の固定allowlist / `username` / Bearer トークン / boolean権限 / Redis CRUD 管理UI のゲート）。

team_schedules の認証は対象も性質も別物：

| | 既存（開発者認証） | team_schedules（利用者認証） |
| --- | --- | --- |
| 対象 | 固定allowlistの開発者 | Discordサーバーに居る誰でも（セルフサインアップ） |
| ログイン | username/password | Discord magic-link |
| ID | `username` | `userId`(uuid, Postgres) |
| 運搬 | Bearer トークン | HttpOnly Cookie |
| 権限 | boolean（管理者か） | チーム単位の role（team_members から都度判定） |

**方針: `SessionData` の共用・`validateSession` の拡張は禁止。認証ドメインごと別系統にする。**

理由（セキュリティ）: 共用すると magic-link でログインした一般ユーザー（＝Discordに居る誰でも）のトークンが既存 `validateSession()` を通り、**Redis CRUD 管理UI のゲートを突破できてしまう**。検証パスを分離してこれを構造的に防ぐ。

```txt
既存（触らない）= 開発者セッション
  app/_server/lib/session.ts        prefix "session:"  / Bearer / username

新規 = 利用者セッション（team_schedules専用）
  app/_domains/teamSchedules/_server/session.ts
    - Redisキー prefix "ts-session:"   ← キー空間を分離（既存 validateSession は ts-session を認識しない）
    - userId ベースの SessionData
    - HttpOnly + Secure + SameSite=Lax Cookie "ts_session"  ← 運搬も分離
    - createUserSession(userId) / getUserIdFromSession(req) / deleteUserSession(token)
```

- 既存 [session.ts](../../my-app/app/_server/lib/session.ts) には「これは開発者/管理者用。一般利用者認証は teamSchedules/_server/session.ts」とコメントを足すに留める（リネームは利用箇所が複数ありスコープ外）。
- team_schedules 側の認可は「ts-session が有効か」+「team_members の role」の2層で完結。

### Discord コマンド登録

- [commands.ts](../../my-app/app/_server/util/commands.ts) に新カテゴリ追加（プレフィックス `team-schedule-`）:
  - `COMMANDS.TEAM_SCHEDULE.LOGIN = "team-schedule-login"`
  - ※ handoff の `/team_schedule_login` は Discord コマンド名規約（小文字+ハイフン、規約のプレフィックス方針）に合わせ `team-schedule-login` とする。
- [register.ts](../../my-app/app/api/discord/command/register.ts) にコマンド定義追加。
- [route.ts](../../my-app/app/api/discord/route.ts) の switch に振り分け追加。
- 実装ファイル: `app/api/discord/command/team-schedule/login.ts`（1コマンド=1ファイル規約）。
  - ephemeral 返信は `InteractionResponseType.ChannelMessageWithSource` + `flags: 64`（EPHEMERAL）。

### CRUD エンドポイント

公開範囲: handoff 3章（閲覧は誰でも可 / 書き込みは認証 + 権限チェック）。

| メソッド | パス | 認証 | 権限 | 内容 |
| --- | --- | --- | --- | --- |
| GET | `/api/web/team-schedules/teams` | 不要 | public | チーム一覧 |
| GET | `/api/web/team-schedules/teams/[teamId]` | 不要 | public | チーム詳細 + members |
| GET | `/api/web/team-schedules/teams/[teamId]/schedules?from=&to=` | 不要 | public | 期間内の schedules 生データ（グリッド描画用） |
| PUT | `/api/web/team-schedules/teams/[teamId]/schedules` | 必要 | 本人列 | セルの upsert（status/note）。本人=session userId の行のみ |
| DELETE | `/api/web/team-schedules/teams/[teamId]/schedules` | 必要 | 本人列 | セルを未記入に戻す（行 DELETE） |
| POST | `/api/web/team-schedules/teams` | 必要 | — | チーム作成（作成者を admin として team_members に追加） |
| POST | `/api/web/team-schedules/teams/[teamId]/members` | 必要 | admin | メンバー追加 / ロール(top..support)・team_role 設定 |
| PATCH | `/api/web/team-schedules/teams/[teamId]/members/[userId]` | 必要 | admin/本人 | ロール・can-play 更新 |
| DELETE | `/api/web/team-schedules/teams/[teamId]/members/[userId]` | 必要 | admin | メンバー除名 |
| PATCH | `/api/web/team-schedules/teams/[teamId]` | 必要 | admin | name/description/required_count 更新 |

書き込み系の原則（handoff 5章）:

- **未記入 = 行が無い**。status を付けたら upsert、未記入に戻したら DELETE。
- `status` は `ok / maybe / ng` の3値のみ（CHECK + Drizzle enum）。
- schedule の編集は `(teamId, userId)` が team_members に存在する人のみ（複合FKで DB レベルも保証）。
- 個人は自分の userId の行だけ編集可。admin はチーム/メンバー管理。

### 認可ヘルパー

`app/_domains/teamSchedules/_server/` に:

- `getSessionUserId(request)`: Cookie → session → userId 解決（未認証なら null）
- `assertTeamMember(teamId, userId)` / `assertTeamAdmin(teamId, userId)`: team_members を引いてロール判定
- 認可失敗時は handoff/規約に従い、リソース秘匿が必要な場面では 404 を返す（[coding-standards.md](../../.claude/rules/coding-standards.md)）。

## 作業ステップ（推奨順）

1. 依存追加 + `DATABASE_URL` 環境変数（env.ts / setup.md / Vercel）
2. Drizzle スキーマ移設（`schema.ts`）+ password_hash を nullable に + `types.ts` 型 re-export
3. `drizzle.config.ts` + `drizzle.ts` クライアント、migration 生成 → Neon 適用（インフラ別セッションと連携）
4. セッション拡張（userId 対応）+ 認可ヘルパー
5. magic-link: Redis キー設計 + `auth/verify` エンドポイント
6. Discord コマンド `team-schedule-login`（commands.ts / register.ts / route.ts / login.ts）
7. public read 系 GET エンドポイント（teams / schedules）
8. write 系（schedules upsert/delete → team/member 管理）
9. 各エンドポイントのバリデーション + テスト（規約: `success:` / `failure:` プレフィックス、vitest）

## 留意点・落とし穴（handoff 8章 + 本計画）

- **Drizzle の CHECK 出力**: `drizzle-kit generate` の SQL に `CONSTRAINT ... CHECK` が入っているか目視確認。無ければ [schema.sql](files/schema.sql) を手適用。
- **Neon コネクション**: `@neondatabase/serverless`（HTTP）採用でサーバーレス枯渇を回避。
- **Discord snowflake**: `discord_user_id` は text で保存（数値オーバーフロー回避）。
- **custom_id 100文字制限 / 3秒以内応答**: login コマンドはトークン生成 + ephemeral 返信のみで軽量なので問題なし。
- **Redis と Postgres の役割分担**: 集計キャッシュに Redis は使わない（handoff 7章。早すぎる最適化）。
- **CLAUDE.md のドメインパス表記**: 文書は `app/domains/` だが実体は `app/_domains/`。実装は `_domains` に合わせる。

## 本計画では決めない/別セッション

- グリッド UI（TanStack Table）・比較チームの in-page セレクタ・成立列統合・モバイル幅
- Neon プロジェクトのプロビジョニングと接続文字列の発行
- 将来拡張（member_role_details、matchups、Redis read-through cache）
