# team_schedules: 参加履歴イベントテーブル（アプリ参加 / チーム参加の招待・入会・脱退）

> 関連 issue: [#108](https://github.com/shari-sushi/discord-janken/issues/108)（招待リンク管理）, [#107](https://github.com/shari-sushi/discord-janken/issues/107)（操作ログのDB保存）
> 関連計画: [20260616-10-team_schedules-操作ログのDB保存.md](./20260616-10-team_schedules-操作ログのDB保存.md)（暫定案を本計画で具体化）
> 関連 PR: #117（`team_members.invited_by` 列で記録する暫定実装）→ **本計画のイベントテーブルに置き換える**

## 目的・背景

「誰の招待で入ったか」を永続記録したい（#108）。PR #117 は `team_members.invited_by` 列で実装したが、以下の弱点が議論で判明した:

- **再参加で履歴が潰れる**: `onConflictDoNothing` のため初回の発行者しか残らない。脱退→別の人の招待で再参加しても上書きされない。
- **普段 read しない情報を中心テーブルに載せる**: `team_members` はチーム表示・スケジュールで頻繁に read する。発行者情報は監査/将来のダッシュボードでしか使わない。
- **自発参加・不明の表現が曖昧**: 「招待者なし」を null にすると「招待経由でない参加」と「発行者不明（データ欠損）」が区別できない。発行者に自分の id を入れると `inviter = joiner` の行がノイズになり検索性が悪い。

→ **状態テーブル（users / team_members）はそのまま“今の状態”を表し、招待・入会・脱退の履歴は専用のイベントテーブルに積む**二層構成にする。

### 重要な気づき: チーム招待はアプリ参加も引き起こす

招待リンク経由で**新規ユーザー**が入ると、`resolveOrCreateUserByDiscordId` が `users` 行を作る。つまり1回の招待リンク踏みで「チーム参加」と「アプリ参加」が同時に発生し、**アプリ参加もその発行者による招待**になる。よってアプリ側イベントにも発行者（inviter）の概念が必要。

## 実装計画

### 1. スキーマ（[schema.ts](../../my-app/app/_domains/teamSchedules/_server/schema.ts)）

状態テーブルとは別に、履歴用イベントテーブルを2つ新設する。テーブルを分ける理由は **スコープ（team_id の有無）とライフサイクルが違う**ため（チーム脱退してもアプリには残る）。1テーブルに統合すると team_id が nullable になり FK/NOT NULL 制約が緩む。

```text
app_membership_events            -- アプリ全体への参加/脱退履歴
  user_id          uuid   FK→users   onDelete cascade
  type             text   'joined' | 'left'
  source           text   'invite' | 'self'
  inviter_user_id  uuid?  FK→users   onDelete set null   -- source='invite' のときのみ非null
  occurred_at      timestamptz default now()

team_membership_events           -- 特定チームへの参加/脱退履歴
  team_id          uuid   FK→teams   onDelete cascade
  user_id          uuid   FK→users   onDelete cascade
  type             text   'joined' | 'left'
  source           text   'invite' | 'master' | 'self'
  inviter_user_id  uuid?  FK→users   onDelete set null   -- source='invite' のときのみ非null
  occurred_at      timestamptz default now()
```

設計の要点:

- **inviter_user_id は招待経由のときだけ入れる純粋な FK**。自分の id は入れない（検索ノイズになる）。
- **参加の種別は `source` 列が持つ**。null に複数の意味を背負わせない。「Aが招待した人」は `WHERE inviter_user_id = A` でノイズなく引ける。
- `type='left'` は脱退・退会機能が未実装のため当面は使わない（将来用に器だけ用意）。
- CHECK 制約で `type` / `source` の値を限定する（`db:generate` 後に SQL へ CHECK が出るか目視確認）。
- index: 当面は不要。将来「発行者別一覧」を作るとき `inviter_user_id` に btree を追加。

### 2. イベント発火マトリクス

| ケース | app_membership_events | team_membership_events |
| --- | --- | --- |
| 招待リンク・**新規**ユーザー | joined / source=invite / inviter=A | joined / source=invite / inviter=A |
| 招待リンク・**既存**ユーザー | （発火しない。既にアプリにいる） | joined / source=invite / inviter=A |
| チーム作成（master） | （別途 or 既存） | joined / source=master / inviter=null |
| 直接ログインで初参加（将来） | joined / source=self / inviter=null | — |

### 3. 各経路への記録追加

書き込み箇所（調査済み・[invite.ts](../../my-app/app/api/discord/command/team-schedule/invite.ts) / [join/route.ts](../../my-app/app/api/web/team-schedules/join/route.ts) / [teams/route.ts](../../my-app/app/api/web/team-schedules/teams/route.ts) / [userResolver.ts](../../my-app/app/_domains/teamSchedules/_server/userResolver.ts)）:

- `resolveOrCreateUserByDiscordId` が **新規作成した場合のみ** `app_membership_events`(joined) を記録。inviter は呼び出し元から渡す（招待経由なら発行者、それ以外は null）。
  - 既存ユーザー判定が必要なので、戻り値に「新規作成したか」を含める。
- Discord 招待 join / confirmJoin・Web join → `team_membership_events`(joined, source=invite, inviter=payload.invitedBy)。冪等性は状態テーブル（team_members）側の `onConflictDoNothing` で担保し、**イベントは実際に新規 INSERT できたときだけ**記録する（再参加の二重記録を避ける）。
- チーム作成（master） → `team_membership_events`(joined, source=master)。

### 4. #117 の扱い

- `team_members.invited_by` 列・マイグレーション `0003_hot_mimic.sql` は**破棄**（本番未適用なので剥がすマイグレーション不要）。
- #117 のブランチ（feat/team-schedule-invite）はクローズ or 本計画ベースで作り直し。`invitedBy` を Redis ペイロードに載せる部分（[invites.ts](../../my-app/app/_domains/teamSchedules/_server/invites.ts)）は本計画でもそのまま使える。

### 5. マイグレーション

- `npm run db:generate` で SQL 生成 → CHECK 制約の有無を目視確認 → ローカル（Docker）に `db:migrate` → 動作確認。
- 本番 Neon へはマージ後に手動適用（`DATABASE_URL="<neon>" npm run db:migrate`）。

### 6. テスト

- `success:` 招待リンク新規参加で app/team 両方の joined が記録される
- `success:` 招待リンク既存ユーザーで team のみ記録される（app は記録されない）
- `success:` master 作成で team_membership_events(source=master, inviter=null) が記録される
- `success:` 再参加（既存 team_members 行あり）でイベントが二重記録されない
- `failure:` source/type が許可値以外は CHECK 制約で弾かれる

## 技術選定

- **二層構成（状態テーブル + イベントログ）**: 監査ログの王道。状態と履歴の関心を分離。
- **イベントテーブルをスコープごとに2分割**: ポリモーフィック（type で意味が変わる nullable FK）を避け、DB 制約を効かせる。
- **source 列で参加種別を明示**: null の多義性を排除し、発行者検索のノイズをなくす。

## 未確定・確認事項

- [ ] `source` の取りうる値の最終確定（特にアプリ側に将来 `invite` 以外の入口があるか）
- [ ] `app_membership_events` を今回まとめて作るか、`team_membership_events` だけ先行するか（「後のデータ移行が面倒」方針なら同時作成）
- [ ] イベントテーブルの主キー設計（連番 id / `gen_random_uuid()` / 複合）
- [ ] 既存 #117 ブランチをクローズして本計画で新規ブランチにするか、同ブランチで作り直すか
