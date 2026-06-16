# team_schedules: ログアウト機能（API + フロント導線）

> 元 issue: [#91](https://github.com/shari-sushi/discord-janken/issues/91)（PR #88 レビューで検出）
> ⚠️ 本計画は暫定。仕様は 2026-06-17 に作者と確定する。

## 目的・背景

スクリム調整機能の利用者セッションに**ログアウトのエンドポイントが無い**。
セッション削除関数 `deleteUserSession`（[session.ts](../../my-app/app/_domains/teamSchedules/_server/session.ts)）は実装済みだが、呼び出す API ルートとフロントの導線が未実装。

現状ユーザーは自分でセッションを終了できず、Cookie (`ts_session`) の `maxAge` 30日の自然失効を待つしかない。

## 実装方針（案）

`deleteUserSession` は実装済みなので、ルート + クライアント + UI の接続のみ。

### 1. ログアウト API

- `POST /api/web/team-schedules/auth/logout`
- Cookie (`ts_session`) からトークンを読み、`deleteUserSession` で Redis のセッションを削除
- レスポンスで `ts_session` Cookie を失効（`maxAge: 0`）
- 未ログイン（Cookie 無し）でも 200 を返す冪等な設計にするか要検討

### 2. クライアント API クライアント

- [teamSchedulesApiClient.ts](../../my-app/app/_domains/teamSchedules/_client/teamSchedulesApiClient.ts) に `logout()` を追加

### 3. フロント導線

- ログイン中ユーザー表示の近く（[ControlBar.tsx](../../my-app/app/team_schedules/_components/ControlBar.tsx) もしくはヘッダー）にログアウトボタン
- ログアウト後はセッション state をクリアし、未ログイン表示へ戻す

## テスト

- ログアウト API（`success:` Cookie 削除・Redis セッション削除 / `failure:` 未ログイン時の挙動）

## 確認事項（2026-06-17 に決定）

- [ ] ログアウトボタンの配置（ヘッダー／ControlBar／ユーザー名横）
- [ ] 未ログイン状態でのログアウト呼び出しを 200（冪等）にするか 401 にするか
- [ ] ログアウト後の着地（同ページに留まる／トップへ遷移）
