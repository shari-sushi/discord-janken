# team_schedules: 自分の発行した招待リンクの管理

> 元 issue: [#108](https://github.com/shari-sushi/discord-janken/issues/108)
> ⚠️ 本計画は暫定。仕様は 2026-06-17 に作者と確定する。

## 目的・背景

> - 自分の発行した招待リンクを無効化できるようにする（自分の発行したリンクを閲覧できるようにする）

現状、招待リンク発行（[invite/route.ts](../../my-app/app/api/web/team-schedules/teams/%5BteamId%5D/invite/route.ts) / クライアント `createInvite`）と参加（[join/route.ts](../../my-app/app/api/web/team-schedules/join/route.ts) / `joinTeam`）はあるが、**発行済みリンクの一覧表示・無効化（revoke）ができない**。

## 現状調査が必要な点

- 招待トークンの保存先（Redis か DB か）と TTL・発行者情報を持っているか
- 1回限り使用か複数回使用か、有効期限（`createInvite` は `expiryDays` を返す）

上記を確認してから設計する（発行者 ID をトークンに紐付けていない場合は保存方式の変更が必要）。

## 実装方針（案）

### 1. 招待トークンに発行者・チームを紐付けて保存

- `invitedBy`（userId）, `teamId`, `createdAt`, `expiresAt` をトークンメタに保持
- 一覧・revoke のため、発行者で引けるインデックス（Redis なら `ts:invite:by-user:{userId}` の集合 等）

### 2. API

| メソッド | パス | 認可 | 内容 |
| --- | --- | --- | --- |
| GET | `/teams/[teamId]/invites`（or `/me/invites`） | 発行者本人/admin | 自分の発行リンク一覧 |
| DELETE | `/invites/[token]` | 発行者本人/admin | リンク無効化 |

### 3. フロント

- 招待モーダル（[InviteModal.tsx](../../my-app/app/team_schedules/_components/InviteModal.tsx)）に発行済み一覧 + 無効化ボタン

## 確認事項（2026-06-17 に決定）

- [ ] 現状の招待トークンの保存方式（Redis/DB）と TTL・使用回数（実装を確認してから）
- [ ] 一覧の単位：チームごと（`/teams/[teamId]/invites`）か自分基準（`/me/invites`）か
- [ ] admin/master は他人の発行したリンクも無効化できるか
- [ ] リンク本体（トークン文字列）を一覧で再表示するか、識別子のみ見せるか（漏洩リスク）
