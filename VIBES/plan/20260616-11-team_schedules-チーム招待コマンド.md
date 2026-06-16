# team_schedules: チーム招待コマンド

> 元 issue: [#109](https://github.com/shari-sushi/discord-janken/issues/109)（親: #94）

## 目的・背景

現状 `/team_schedules` の参加は Web ログインが前提で、Discord 上だけでは完結しない。
本タスクでは「チーム管理者が Discord でコマンドを打つ → チャンネルに公開の参加ボタンが出る → サインインの有無に関わらず押した人が member 参加できる」フローを追加する。Discord ID からアプリアカウントを自動解決/作成するため、Web ログイン不要で参加できるのが要点。

### issue #109 の要約

- チーム管理者がコマンドを打つ
- 全体に向けてリンク生成ボタン出現
- サインインしてる・してないに関わらず、押した人がチームに member 参加する
- 別チーム加入済みの人は、乗り換える（追加加入する）かどうかの確認が出る

### 確定仕様（作者と確認済み）

1. **対象チームの決定**: 実行者（Discord ID）が master/admin のチームを検索。1つなら自動採用、複数ならセレクトメニューで選ばせてから公開メッセージを投稿。
2. **乗り換え時の挙動**: 既に別チームに所属している人がボタンを押した場合、**既存所属は抜けず追加加入**（警告のみ）。DB は M:N 多チーム可（schema コメント「所属はここに持たせない＝複数チーム可」）なので master 不在問題は発生しない。
3. **ボタン方式**: 既存の `ts:invite` トークン方式（Redis・7日 TTL）を発行し custom_id に埋め込む。期限切れ・将来の失効(#108)と整合。

## 実装計画

### 1. 共通ヘルパー抽出（DRY）

- `createInviteToken(teamId, invitedBy?)` を新規 `_domains/teamSchedules/_server/invites.ts` に切り出し、Web 招待ルートと Discord コマンド双方で利用。`InvitePayload` も同モジュールへ移動（任意の `invitedBy` を追加）。
- `resolveOrCreateUserByDiscordId(discordUserId, username)` を新規 `_server/userResolver.ts` に切り出し、`auth/verify` のセルフサインアップをこれに置き換え。Discord 参加ハンドラからも利用。

### 2. 定数・配線

- `commands.ts`: `COMMANDS.TEAM_SCHEDULE.INVITE` と `CLIENT_ACTIONS.TEAM_SCHEDULE`（`SELECT_INVITE_TEAM` / `JOIN` / `CONFIRM_JOIN`）を追加。
- `extractCustomIdParam.ts`: `extractInviteToken`（param `invite`）を追加。
- `route.ts`: ApplicationCommand と MessageComponent の switch に上記を配線。
- `register.ts`: `team-schedule-invite` コマンド定義を追加。

### 3. コマンド/ハンドラ本体

新規 `app/api/discord/command/team-schedule/invite.ts`（1機能=1ファイル）:

- `teamScheduleInviteCommand`: 実行者の管理チームを検索 → 1つなら公開募集メッセージ、複数なら ephemeral セレクト、0件なら ephemeral エラー。
- `handleSelectInviteTeam`: 選択チームの管理権限を再確認 → 公開募集メッセージ投稿。
- `handleJoinButton`: token 検証 → user 解決/作成 → 既参加なら通知、別チーム所属なら追加加入の確認、未所属なら即 member 参加。
- `handleConfirmJoinButton`: token・user 再解決 → 追加加入実行。

> 補足: issue は「モーダル」だが、Discord のモーダルは TextInput 必須で Yes/No 確認に使えないため、確認は **ephemeral メッセージ + ボタン**で実装する。

## 技術選定

- 招待トークンは既存 Redis（`ts:invite:{token}`・7日 TTL・複数人利用可）を再利用。Web 招待リンクと完全に同一の仕組みに統一。
- 多チーム所属は DB スキーマ（`team_members` M:N）の既定挙動をそのまま使う。

## 検証

- `npm run lint` / `npx tsc --noEmit` がクリーン。
- ローカルは ngrok で Discord エンドポイント公開 → `npx tsx app/api/discord/command/register.ts` でコマンド登録（反映に最大1時間）。
- E2E: 管理チーム1/複数、管理チーム無し、未ログインユーザーの参加（自動アカウント作成）、既参加、別チーム所属者の追加加入/キャンセル、期限切れ token。
- DB: `team_members` に `team_role='member'` 行が追加され、旧所属が残ること。
