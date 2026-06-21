# team_schedules: 活動可能日に Discord 通知 (#177)

## 目的・背景

`/team_schedules`（スクリム調整）では、メンバーが日別予定を入力し「活動可能」かどうかを
**画面を開いたとき初めて**確認できる。能動的に見に行かないと人数が揃った日を逃すため、
「活動可能な日」を Discord へ自動リマインドして見落としを防ぐ。

### issue #177 の要約（要件確認済み）

- **トリガー**: 活動可能と判定された日について、**その日の指定時刻**にリマインド通知。
  - members モード: `status='ok'` の人数 ≥ `required_count` の日
  - team モード: `team_day_status.status='ok'` の日
- **通知時刻**: admin 以上（master / admin）が「当日の何時に通知するか」(HH:MM) を設定。
- **通知先**: チームに登録した **Discord チャンネルID**（Bot トークン + channelId で投稿。
  既存タイマー／LoLリマインダーと同方式。Webhook URL をチーム毎に保存せずに済む）。
- **対象**: members / team 両モード。
- **インフラ**: 既存 QStash（単発遅延実行 `notBefore`）をそのまま採用。新規 cron は導入しない。

## 技術選定（方式）

QStash は単発遅延実行のみ。そこで「**予定が書き込まれて活動可能になった瞬間に、その日の指定時刻へ
単発ジョブを登録**」し、「**発火時にもう一度活動可能か再判定**」して送る
（既存 `reminder-execute` の「両チーム登録済みなら送らない」と同じ流儀）。
再判定を真実とすることで、後から条件割れ／設定変更が起きても誤通知しない。
重複登録は Redis マーカーで防ぐ。明示キャンセルは行わない（発火時再判定で代替）。

## 実装計画

### 1. スキーマ追加（`teams` に2列）

`app/_domains/teamSchedules/_server/schema.ts` の `teams` に追加:

- `notifyChannelId text("notify_channel_id")`（nullable）— 通知先 Discord チャンネルID
- `notifyTime text("notify_time")`（nullable）— "HH:MM"（JST）。`time` 型ではなく text
  （日付・note と同じ「文字列でTZ事故回避」の流儀。形式はアプリ側 validator で検証）

両方 non-null のとき通知有効とする（別途 enabled boolean は持たない）。

**マイグレーション**: 新規 `0005_*` を Drizzle 生成。作業前に
`.claude/rules-on-demand/database.md` を必読（ローカル/本番DB・適用手順）。

### 2. 活動可能判定ヘルパー（新規 `_server/activity.ts`）

トリガー側と発火側で再利用:

- `isDayActive(teamId, day)`:
  - members: `schedules` の (team, day, status='ok') を COUNT → `>= requiredCount`
    （既存インデックス `idx_schedules_team_day` を利用）
  - team: `team_day_status` の (team, day) が `status='ok'` か
- `findActiveFutureDays(teamId, fromDay)` — 設定変更時のバックフィル用
  （今日以降で活動可能な日の一覧）
- `combineDayAndTimeJst(day, hhmm)` — DayKey + HH:MM(JST) → UTC Date。
  JST=UTC+9 の換算は `app/_domains/lol/_server/validators.ts` の `parseReminderAt` を参考
- `scheduleActivityNotification(teamId, day)` — 下記トリガー本体

### 3. 通知ジョブ登録（トリガー）

`scheduleActivityNotification(teamId, day)` を以下から呼ぶ:

- `teams/[teamId]/schedule/route.ts` の `PUT` / `DELETE` 成功後（members）
- `teams/[teamId]/team-status/route.ts` の `PUT` / `DELETE` 成功後（team）

処理:

1. team の `notifyChannelId` / `notifyTime` が両方セット済みか（未設定なら何もしない）
2. `isDayActive` が false なら何もしない
3. 発火時刻を `combineDayAndTimeJst` で算出。過去なら登録しない
4. Redis マーカー `ts:notify:sched:{teamId}:{day}` があれば二重登録回避でスキップ
5. `qstashPublishJSON(`${APP_URL}/api/web/team-schedules/notify/execute`, { teamId, day }, unixSec)`
6. 成功後にマーカー SET（TTL=その日の終わりまで。publish 失敗時はマーカーを残さずログのみ）

**必ず try/catch で包み、失敗しても予定書き込みのレスポンスは成功のまま返す**
（通知はベストエフォート。LoLリマインダー登録失敗と同方針）。
ペイロードは `{ teamId, day }` のみ。チャンネル・本文は発火時に最新を読む。

### 4. 発火コールバック（新規エンドポイント）

`app/api/web/team-schedules/notify/execute/route.ts`（`timer/execute/route.ts` を雛形に）:

1. QStash `Receiver` で `upstash-signature` 検証（署名キーは env 既存）
2. payload `{ teamId, day }` を parse
3. `isDayActive` を再判定 → false なら 200 no-op（条件割れ・設定OFFを吸収）
4. team の `notifyChannelId` 取得（無ければ no-op）
5. 本文（チーム名・日付・「活動可能 OK n/required 人」・各メンバーの ok と note。
   team モードは team_day_status の note）を組み、`sendDiscordMessage(channelId, content)` で投稿
6. @メンションは MVP では行わない（チャンネル投稿のみ）

作業前に `.claude/rules-on-demand/web-api.md` を必読。

### 5. 設定UI（admin が channelId / time を設定）

既存の admin ゲート済み `PATCH /api/web/team-schedules/teams/[teamId]`
（`assertTeamAdmin` + suspended チェック済み）に `notifyChannelId` / `notifyTime` を追加:

- validator 追加（`_server/validators.ts`）: `isHhmm`（00:00〜23:59）、
  `isDiscordChannelId`（17〜20桁の数字列）。空文字/null で解除可
- フロント設定フォーム（`app/team_schedules/_components/` の設定系）に
  「通知チャンネルID」「通知時刻(HH:MM)」入力を追加。チャンネルIDは Discord 開発者モードで
  「チャンネルIDをコピー」して貼り付ける旨を補足表示
- **バックフィル**: notify 設定を新規セット/変更したら `findActiveFutureDays(teamId, 今日)` を回し、
  未登録の各日に `scheduleActivityNotification` を実行（設定前に入力済みの活動可能日も拾う）

### スコープ外（MVP）

- 条件割れ時の QStash ジョブ明示キャンセル（発火時再判定で代替）
- @メンション通知・DM 通知
- 通知済み履歴・複数回通知制御

## 変更ファイル一覧

- 変更: `schema.ts`（2列追加）+ 新規マイグレーション `0005_*`
- 新規: `_server/activity.ts`
- 変更: `teams/[teamId]/schedule/route.ts`、`teams/[teamId]/team-status/route.ts`（トリガー呼び出し）
- 変更: `teams/[teamId]/route.ts`（PATCH に notify 設定 + バックフィル）
- 変更: `_server/validators.ts`（`isHhmm` / `isDiscordChannelId`）
- 新規: `api/web/team-schedules/notify/execute/route.ts`
- 変更: `app/team_schedules/_components/`（設定フォーム2項目）
- 変更: `types.ts`（notify フィールド）、`_client/teamSchedulesApiClient.ts`

## 検証

1. `npm run lint` / `npx tsc --noEmit` を通す。
2. ユニットテスト（`success:` / `failure:` プレフィックス）:
   - `isDayActive`（members 閾値前後 / team ok・ng）
   - `combineDayAndTimeJst`（JST→UTC・過去判定）
   - `isHhmm` / `isDiscordChannelId` 境界
3. ローカル e2e（QStash＋トンネルURL。ngrok 等で `APP_URL` 公開）:
   - 設定で channelId + 直近時刻 → 閾値まで OK 入力 → ジョブ登録をログ/ダッシュボードで確認
   - 指定時刻に該当チャンネルへ通知が届く
   - 通知前に閾値割れ → 発火時 no-op で送られない
   - 活動可能な未来日がある状態で後から設定 → バックフィルで登録される
4. 本番反映前にマイグレーション適用手順（database.md）を確認。
   既存 QSTASH_*・APP_URL が揃っていること（追加 env 不要）。

## 参考資料

- 既存タイマー: `app/api/web/timer/execute/route.ts`、`app/api/discord/command/user/timer.ts`
- LoLリマインダー: `app/api/web/lol/matches/reminder-execute/route.ts`
- QStash ラッパー: `app/_server/lib/qstash/qstash.ts`
- Discord送信: `app/_server/lib/discord/api.ts`
