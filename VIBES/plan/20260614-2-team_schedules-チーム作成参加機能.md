# スクリム調整: チーム作成機能・チーム参加機能（#93）

## 目的

`/team_schedules`（スクリム調整）に **チームの作成** と **チームへの参加（join）** の導線を追加する。
現状はログイン（Discord magic-link）はできるが、チームを作るAPI・メンバーを増やすAPIが無く、
「誰もどのチームにも所属できず予定を編集できない」状態。この穴を埋める。

## 背景

### issue #93 の要約

親 issue #94「チーム活動日程調整機能」の子。タイトルは「スクリム調整: チーム作成機能、チーム参加機能」。
本文は空。仕様は本人との壁打ちで以下に確定（2026-06-14）。

### 壁打ちで確定した仕様

- **参加モデル**: 招待リンク方式。admin がトークン付きURLを発行 → 本人がリンクを踏むと自分のアカウントでそのチームに join。
- **作成権限**: 特定ユーザーのみ。ENV で許可した Discord ID を持つログインユーザーだけがチームを作れる。作成者は自動的にそのチームの admin になる。
- **管理モード（案B）**: チームごとに「メンバー集計モード / チーム単位モード」を持つ。
  - `members`: 各メンバーが `schedules` に入力 → `ok数 >= required_count` で活動可能（現行）。
  - `team`: admin がチームとして日別に状態を入力。専用テーブル `team_day_status` に保存。
  - **相手も自分も同じ仕組み**（自/相手の特別扱いはモードフラグで表現）。
  - チーム単位モードのセルも個人と同じ **4状態**（○ / 検討中△ / × / 未記入）。未記入 = 行が無い。

### handoff からの方針変更（記録）

handoff（[VIBES/plan/files/team-schedules-handoff.md](files/team-schedules-handoff.md)）は「相手チーム = `required_count=1` + admin1人のメンバーチーム」という裏技で
チーム単位管理を表現していた（集計式を1本に統一するため）。本 issue では裏技をやめ、
**明示的な `management_mode` 列 + 専用テーブル** に切り替える。理由: モデルがコードに素直に出て読みやすく、
幽霊メンバー行・FK・UI例外処理を避けられる。集計が2系統に増えるが各々は数行でモード分岐するだけ。

## 実装計画

### スライス1: スキーマ基盤 + 作成 + 参加（本 issue の本体）

#### スキーマ（`_domains/teamSchedules/_server/schema.ts`）

1. `teams` に `management_mode text not null default 'members'` を追加。`{ enum: ["members", "team"] }` + 名前付き CHECK `teams_management_mode_chk`。
2. 新規 `team_day_status` テーブル:
   - `team_id uuid` FK→`teams` cascade
   - `day date`
   - `status text` `{ enum: ["ok","maybe","ng"] }` + CHECK `team_day_status_status_chk`
   - `note text`
   - `updated_at timestamptz default now()`
   - PK `(team_id, day)`
3. `npm run db:generate` → 生成SQLに CHECK が出ているか目視確認 → ローカル `db:migrate` → 本番 Neon も後で適用。

#### 型（`_domains/teamSchedules/types.ts`）

- `TeamManagementMode = "members" | "team"` を追加。
- `TeamSummary` / `TeamSchedule` に `managementMode` を追加。
- `TeamSchedule` に `teamStatus: ScheduleEntry[]`（チーム単位モード用・day×1チーム）を追加（スライス2で描画）。

#### 環境変数

- `TEAM_SCHEDULE_CREATOR_DISCORD_IDS`: カンマ区切りの Discord ユーザーID。これを持つユーザーだけチーム作成可。
- `env.ts` に追加し、`.claude/rules/setup.md` の一覧も更新。

#### API

- `POST /api/web/team-schedules/teams`（新規・作成）
  - 要ログイン。session userId → `discord_links` を引き、`discordUserId` が許可リストに含まれなければ 403。
  - body: `{ name, description, managementMode, requiredCount }`。バリデーション（name必須・mode・requiredCount>=1）。
  - `teams` INSERT → 作成者を `team_members`（`team_role='admin'`）に INSERT（同一トランザクション）。
  - レスポンス: 作成した `TeamSummary`。
- 招待発行 `POST /api/web/team-schedules/teams/[teamId]/invite`（新規）
  - 要ログイン + admin（`assertTeamAdmin`）。非adminは 404。
  - Redis に `ts:invite:<token>` = `{ teamId }` を TTL付き保存（既定7日・複数人利用可）。
  - レスポンス: `{ url: "${APP_URL}/team_schedules?join=<token>" }`。
- 参加 `POST /api/web/team-schedules/join`（新規）
  - 要ログイン。body: `{ token }`。Redis から invite を GET（無ければ 401）。
  - `team_members` に `(teamId, userId, team_role='individual')` を `onConflictDoNothing` で INSERT（再参加冪等）。
  - 招待は複数人で使うため即削除しない（TTLで失効）。
  - レスポンス: 参加した `TeamSummary`。

#### Redis キー（`redisKeys.ts`）

- `inviteKey(token)` = `ts:invite:<token>` を追加。

#### クライアント（`teamSchedulesApiClient.ts`）

- `createTeam(input)` / `createInvite(teamId)` / `joinTeam(token)` を追加。

#### フロント（`app/team_schedules/_components/`）

- **作成UI**: 作成権限を持つログインユーザーにだけ「チームを作成」ボタンを表示 → モーダルで name/description/mode/requiredCount 入力。
  - 作成権限の判定: session に「作成可フラグ」が要る。`GET /session` のレスポンスに `canCreateTeam: boolean` を足すのが素直。
- **招待UI**: 自分が admin のチームに「招待リンクを発行」ボタン → URL をコピー表示。
- **参加導線**: ページが `?join=<token>` を検出。
  - ログイン済みなら即 `joinTeam(token)` → チーム一覧を再取得して自チームに選択。
  - 未ログインなら token を保持してログインモーダル → ログイン後に join 実行。
  - 既存の `?token=`（magic-link 着地）処理と同じく、処理後に URL を掃除する。

### スライス2: チーム単位モードの状態編集（直後に実装）

- API: `PUT`/`DELETE /api/web/team-schedules/teams/[teamId]/team-status`（admin限定、`team_day_status` upsert/delete）。
- `GET .../schedule` のレスポンスに `managementMode` と `teamStatus` を含める。
- フロント `TeamSchedulesPage` / `_utils`:
  - `team` モードのチームは **メンバー列を出さず**、チーム1列（`team_day_status` 由来）を admin が4状態で編集。
  - 集計（`aggregateDay` / `success`）を mode で分岐: `team` モードは `teamStatus.status==='ok'` を活動可能とする。
  - 相手チーム列の表示も mode を見て分岐（members→集計、team→チーム状態そのまま）。

## 技術選定

- 招待・セッションは既存どおり **Redis（TTL付き）**。DB は生データのみ（handoff 方針）。
- 作成権限は **Discord ID の ENV 許可リスト**。session userId は signup 時生成の UUID で ENV に書けないため、安定IDの Discord ID で判定する。
- 状態系は **text + 名前付き CHECK**（handoff 方針。値の増減のしやすさ優先）。

## 参考資料

- 設計の出発点: [VIBES/plan/files/team-schedules-handoff.md](files/team-schedules-handoff.md)
- 直前の実装計画: [VIBES/plan/20260614-1-team_schedules-API認証実装とmock解消.md](20260614-1-team_schedules-API認証実装とmock解消.md)
- DBルール: [.claude/rules-on-demand/database.md](../../.claude/rules-on-demand/database.md)
</content>
</invoke>
