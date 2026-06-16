# team_schedules: チームが期待してる日を Discord に可視化

> 元 issue: [#105](https://github.com/shari-sushi/discord-janken/issues/105)
> 関連: [#104](https://github.com/shari-sushi/discord-janken/issues/104)（アプリ内での記入希望日の可視化）
> ⚠️ 本計画は暫定。仕様は 2026-06-17 に作者と確定する。

## 目的・背景

> いちいちアプリを開かなくてもスケジュール感が確認できる
> - チームがメンバーに記入して欲しい期間、日付を設定
> - それが Discord へ投稿され、誰か記入/編集するたびにそれが公開される

アプリを開かずとも Discord 上でスケジュールの埋まり具合が分かるようにする。`#104` の「記入希望期間/日付」データを入力に使う。

## 実装方針（案）

### 1. 記入希望データ

`#104` と共通（期間/日付 + 対象チャンネル/メッセージ）。Discord 投稿先の channelId / messageId をチーム設定に保持。

### 2. Discord への投稿・更新

- 初回: bot がチャンネルにスケジュール状況の埋め込み（embed）を投稿し、messageId を保存
- 更新: 誰かが schedule を upsert/delete するたびに、保存済み messageId の embed を**編集**して最新化（毎回新規投稿しない）
- embed 内容: 記入希望期間、日別の ok/maybe/ng 集計（○数）、未記入者の有無 等

### 3. トリガと非同期処理

- 書き込み API（`PUT/DELETE /schedule`）成功後に Discord 更新を発火
- Discord Interaction の 3秒制約とは別経路（Web API → bot REST 直叩き or QStash）。レート制限に注意（編集を間引く/デバウンス検討）

### 4. 必要な Discord API

- メッセージ投稿・編集（[api.ts](../../my-app/app/_server/lib/discord/api.ts) の既存関数を確認/拡張）

## 確認事項（2026-06-17 に決定）

- [ ] 投稿先チャンネルの指定方法（チーム設定で channelId 登録 / コマンド実行チャンネル）
- [ ] 更新方式：同一メッセージを編集 vs 都度新規投稿（編集が望ましいが messageId 永続化が必要）
- [ ] 更新頻度とレート制限対策（毎編集で更新 / デバウンス / 定期バッチ）
- [ ] embed に載せる情報粒度（集計のみ / 個人名入り / 未記入者リスト）
- [ ] `#104` と同時に進めるか
