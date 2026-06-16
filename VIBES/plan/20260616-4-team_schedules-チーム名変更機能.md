# team_schedules: チーム名変更機能

> 元 issue: [#96](https://github.com/shari-sushi/discord-janken/issues/96)
> ⚠️ 本計画は暫定。仕様は 2026-06-17 に作者と確定する。

## 目的・背景

作成済みチームの名前（および説明）を後から変更できるようにする。現状、チーム作成（[teams/route.ts](../../my-app/app/api/web/team-schedules/teams/route.ts)）はあるが更新エンドポイントが無い。

## 実装方針（案）

### 1. API

- `PATCH /api/web/team-schedules/teams/[teamId]`
- body: `{ name?, description? }`（将来 `requiredCount` / `managementMode` も同経路で扱える）
- 認可: `assertTeamAdmin`（master/admin）。非メンバーは 404。
- バリデーション: `isValidTeamName` / `isValidTeamDescription`（[validators.ts](../../my-app/app/_domains/teamSchedules/_server/validators.ts) に既存）

### 2. クライアント

- [teamSchedulesApiClient.ts](../../my-app/app/_domains/teamSchedules/_client/teamSchedulesApiClient.ts) に `updateTeam(teamId, input)` を追加

### 3. フロント

- チーム設定UI（新規 or 既存モーダルの拡張）から名前変更
- `#97`（メンバー管理）と同じ「チーム設定画面」に同居させると自然

## テスト

- `success:` admin/master が変更できる
- `failure:` member は変更不可（権限不足）/ 非メンバーは 404 / 不正な名前は 400

## 確認事項（2026-06-17 に決定）

- [ ] 変更権限は admin 以上でよいか、master 限定にするか
- [ ] description / requiredCount / managementMode も同じ画面・同じ API で変更可能にするか（スコープ）
- [ ] チーム設定画面を新設するか、既存モーダルを拡張するか（`#97` と共通化したい）
