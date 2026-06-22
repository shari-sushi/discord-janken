# team_schedules: 活動可能日の「時刻指定」通知 (#177)

## 目的・背景

`/team_schedules` では、ある日が「活動可能」になった**立ち上がりエッジで即時** Discord Webhook へ
通知する機能が **#172（PR #181）で実装済み**（[notify.ts](../../my-app/app/_domains/teamSchedules/_server/notify.ts) の
`maybeNotifyActivityReached`、`team_webhooks` / `schedule_notifications` テーブル）。

issue #177 の残る固有要件は「**通知時刻を admin 以上が設定**」＝即時ではなく
**admin が指定した当日の HH:MM(JST) に通知する**こと。本タスクは既存の即時通知基盤の上に
「時刻指定モード」を足す**差分実装**であり、ゼロからの新規ではない。

### issue #177 の要約

- 活動可能になった日について、**admin が設定した当日の時刻 (HH:MM, JST)** にリマインド通知。
- 時刻設定は admin 以上（master / admin）。
- 通知先・本文・活動可能判定・重複防止は **#172 の既存実装をそのまま流用**。

## 設計方針（既存からの差分）

`teams` に **団体単位の通知時刻 `notify_activity_time`（"HH:MM" / nullable）** を1列追加し、

- **未設定（null）** → 現状どおり**即時通知**（`maybeNotifyActivityReached` の挙動を変えない）。
- **設定あり** → 即時送信せず、活動可能の立ち上がりで **QStash 単発ジョブをその日の HH:MM(JST) へ登録**。
  発火時に `aggregateDay` で**再判定**し、まだ活動可能なら既存 Webhook 経路で送信。

これにより「後から条件割れ／設定変更が起きても誤通知しない」を発火時再判定で担保する
（既存 LoL リマインダーの「発火時に再判定」と同流儀）。QStash の明示キャンセルは行わない。

### 重複防止：`schedule_notifications` の `kind` を2種類に拡張

既存テーブルは PK `(team_id, day, kind)`。現状 `kind='activity_reached'`（＝送信済みマーカー）のみ。
時刻指定モードでは:

- `kind='activity_scheduled'` … **QStash 登録済み**マーカー（二重 publish 防止）。
- `kind='activity_reached'` … 既存の**送信済み**マーカー（即時/時刻指定 共通で送信時に INSERT）。

立ち上がり時に `activity_scheduled` を INSERT できた勝者だけが publish。谷に落ちたら
両 kind を DELETE して再武装（既存 instant ロジックと同じ思想）。

## 実装計画

### 1. スキーマ追加（`teams` に1列）＋マイグレーション

[schema.ts](../../my-app/app/_domains/teamSchedules/_server/schema.ts) の `teams` に
`notifyActivityTime text("notify_activity_time")`（nullable）を追加。
`time` 型でなく text（日付・note と同じ「文字列で TZ 事故回避」の流儀。形式は validator で検証）。

新規 `0006_*` を Drizzle 生成。**作業前に [database.md](../../.claude/rules-on-demand/database.md) 必読**。

### 2. 時刻ヘルパー（新規 or notify.ts 内）

- `combineDayAndTimeJst(day: DayKey, hhmm: string): Date` — DayKey + HH:MM(JST) → UTC Date。
  JST=UTC+9 の換算は [validators.ts](../../my-app/app/_domains/lol/_server/validators.ts) の
  `parseReminderAt`（"HH:MM" を JST 解釈して UTC 化）を参考に同等の式で実装。

### 3. `notify.ts` の分岐（即時 / 時刻指定）

`maybeNotifyActivityReached` で team 取得時に `notifyActivityTime` も SELECT し分岐:

- `notifyActivityTime` が null → **現状の即時送信ロジックそのまま**（変更しない）。
- 設定あり →
  1. `aggregateDay` が未達成なら `activity_scheduled` / `activity_reached` 両マーカーを DELETE して終了（再武装）。
  2. 達成なら発火時刻 `combineDayAndTimeJst(day, time)` を算出。**過去なら登録しない**（当日その時刻を過ぎてから活動可能化したケースは MVP では送らない。要件次第で「過去なら即時送信」に変更可 — スコープ外メモ参照）。
  3. `activity_scheduled` を `onConflictDoNothing().returning()`。行が返った勝者だけ
     `qstashPublishJSON(`${APP_URL}/api/web/team-schedules/notify/execute`, { teamId, day }, unixSec)`。
  4. publish 失敗時はマーカーを残さず（DELETE）ログのみ＝次の編集で再試行可能に。

全体は既存同様 try/catch で握り、記入 API レスポンスに影響させない（`after()` 実行のまま）。
ペイロードは `{ teamId, day }` のみ。本文・Webhook・判定は発火時に最新を読む。

### 4. 発火コールバック（新規エンドポイント）

`app/api/web/team-schedules/notify/execute/route.ts`
（[timer/execute/route.ts](../../my-app/app/api/web/timer/execute/route.ts) を雛形に）:

1. QStash `Receiver` で `upstash-signature` 検証（`QSTASH_CURRENT/NEXT_SIGNING_KEY` 既存）。
2. payload `{ teamId, day }` を parse。
3. **`maybeNotifyActivityReached` の送信本体を再利用**して送る。設計のしやすさから notify.ts を
   小さくリファクタし、「達成判定済み前提で Webhook へ送り `activity_reached` マーカーを立てる」
   内部関数（例 `sendActivityReachedNow(teamId, day)`）を切り出し、即時パスと発火パスで共有する。
   発火側は送信前に必ず `aggregateDay` 再判定 → 未達成なら 200 no-op。
4. 送信先 Webhook 無し／本文不正は既存ロジックどおり no-op（200）。
5. **送信本体を再利用することで、既存の `allowed_mentions:{parse:[]}` ピング抑止と
   本文長検証（#181 の対応）を新経路でもそのまま継承する**。発火コールバックで
   `buildContent`／`sendByProvider` を経由せず独自に送信を書き直すと、メンション注入対策が
   再発しうるため必ず既存送信関数を通す。

**作業前に [web-api.md](../../.claude/rules-on-demand/web-api.md) 必読。**

### 5. 設定 API / UI（admin が時刻を設定）

- API: 通知時刻は team 単位設定。既存の admin ゲート済み更新系（`PATCH /teams/[teamId]` または
  Webhook 設定 `PUT /teams/[teamId]/webhooks` と同じ admin 経路）に `notifyActivityTime` を追加。
  どちらに載せるか着手時に既存 admin ゲートの粒度を見て決める（Webhook 設定 UI と同居が自然）。
- validator: [validators.ts](../../my-app/app/_domains/teamSchedules/_server/validators.ts) に
  `isHhmm`（00:00〜23:59、空文字/null で解除）を追加。
- フロント: Webhook 設定 UI の近くに「通知時刻 (HH:MM)」入力を追加。空で即時モードに戻る旨を補足。
- **バックフィル**: 時刻を新規設定/変更したら、今日以降で既に活動可能な日に対して
  `scheduled` 登録を回す（`findActiveFutureDays(teamId, 今日)` を新設）。設定前に揃っていた
  活動可能日も拾うため。コスト次第では初版で見送り、次編集時の自然登録に委ねる選択も可（下記）。

## スコープ外（MVP）

- 過去時刻に活動可能化した場合の即時フォールバック送信（初版は「登録しない」）。
- バックフィル（設定変更時の遡及登録）は重ければ次フェーズへ。その場合は「設定後に各日を1回編集すれば登録される」挙動。
- QStash ジョブの明示キャンセル（発火時再判定で代替）。
- @メンション・DM・複数回通知・通知履歴。
- per-slot ごとの個別通知時刻（時刻は team 単位）。

## 変更ファイル一覧

- 変更: [schema.ts](../../my-app/app/_domains/teamSchedules/_server/schema.ts)（`notify_activity_time` 1列）＋新規 `0006_*`
- 変更: [notify.ts](../../my-app/app/_domains/teamSchedules/_server/notify.ts)（分岐・送信本体の切り出し・`combineDayAndTimeJst`）
- 新規: `app/api/web/team-schedules/notify/execute/route.ts`
- 変更: [validators.ts](../../my-app/app/_domains/teamSchedules/_server/validators.ts)（`isHhmm`）
- 変更: 設定 API（`teams/[teamId]` か `webhooks` ルート）＋ [types.ts](../../my-app/app/_domains/teamSchedules/types.ts)
- 変更: 設定フロント（`app/team_schedules/_components/` の Webhook 設定系）＋ API クライアント

## 検証

1. `npm run lint` / `npx tsc --noEmit`。
2. ユニット（`success:` / `failure:` プレフィックス）:
   - `combineDayAndTimeJst`（JST→UTC・過去判定）
   - `isHhmm` 境界（"00:00" / "23:59" / "24:00" / "9:5" / 空）
   - notify 分岐（time null=即時 / time あり=scheduled マーカー INSERT と publish 呼び出し、未達成で DELETE 再武装）
3. ローカル e2e（QStash＋トンネル URL、`APP_URL` 公開）:
   - 通知時刻を直近に設定 → 閾値まで OK 入力 → `activity_scheduled` 登録をログ/DB で確認
   - 指定時刻に Webhook へ届く＋`activity_reached` マーカー
   - 発火前に閾値割れ → 発火時 no-op で送られない
   - 時刻を空に戻す → 即時モードに戻る（即時通知が走る）
   - （実装するなら）バックフィルで既存活動可能日が登録される
4. 本番反映前にマイグレーション適用手順（database.md）確認。追加 env 不要（既存 `QSTASH_*` / `APP_URL`）。

## 参考資料

- 既存即時通知: [notify.ts](../../my-app/app/_domains/teamSchedules/_server/notify.ts)（#172 / PR #181）
- QStash 単発遅延: [qstash.ts](../../my-app/app/_server/lib/qstash/qstash.ts) `qstashPublishJSON`
- 発火コールバック雛形: [timer/execute/route.ts](../../my-app/app/api/web/timer/execute/route.ts)
- JST→UTC 換算: [validators.ts](../../my-app/app/_domains/lol/_server/validators.ts) `parseReminderAt`
