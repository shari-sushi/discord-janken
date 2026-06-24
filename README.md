# LoL Custom Tool (Discord Bot)

※ TODO: READMEちゃんとする

## デプロイ・ブランチ運用

- `main` へ push/merge → 本番へ自動デプロイ、コマンドを PUT で完全更新
- 非 `main` へ push → 各ブランチへ自動デプロイ & guild command に登録（差分を POST）
  - コマンド定義の調整は反映されないので注意
- `develop` へ push/merge → Discord Bot canary 版に自動反映。サンドボックスチャンネルで動作確認可能。気軽に push してよい

※guild command は即時反映、global command はコマンド登録の反映に最大1時間かかる

## webアプリ

ブラウザで使う機能。[`/lol`](https://discord-janken.vercel.app/lol) が下記をまとめたハブページです。

- [ロールルーレット](https://discord-janken.vercel.app/lol/role-roulette) — LoL のロール抽選（Discord の `/lol-role-roulette` の web版）
- [全ランク確認](https://discord-janken.vercel.app/lol/all-ranked) — サモナーのランク履歴を表示（Riot API 使用）
- [op.gg マルチサーチリンク生成](https://discord-janken.vercel.app/lol/opgg-multi-link) — 複数サモナーの op.gg マルチサーチURLをまとめて生成
- [チーム活動 スケジュール調整](https://discord-janken.vercel.app/team_schedules) — チーム単位の活動予定調整ツール（Discord の `/team-schedule-*` の入口）

> `/login`・`/developers/*` は認証／開発者用ページのため一覧から除外しています。

## discord bot

各コマンドの概要と、Bot に付与すべき Discord パーミッションをプレフィックスごとにまとめます。Bot をサーバーに追加する際は、使うコマンドに対応した権限を付与してください。

- `View Channel` は全コマンドで必要です（各表では省略）。
- スレッド内で使う場合は追加で `Send Messages in Threads` が必要です。
- `(一部実装中)` のコマンドは一部機能が未完成です。

### League of Legends（`/lol-*`）

LoL のカスタムゲーム運営向け。

- `/lol-new-match`: ブルー／レッド両サイドのプロテクトやロール選択を入力し、同時発表する
- `/lol-random-side`: ブルーサイド／レッドサイドをランダム抽選する
- `/lol-role-roulette` `(一部実装中)`: 参加者のロール（TOP/JG/MID/ADC/SUP）をルーレット抽選する。リアクションで参加者を集める方式だが、リアクションユーザー取得がレートリミットに引っかかる課題あり（#196）。web版は [ロールルーレット](https://discord-janken.vercel.app/lol/role-roulette) を参照

| コマンド | Send Messages | Add Reactions | Read Message History | Manage Messages |
| :--- | :---: | :---: | :---: | :---: |
| `/lol-new-match` | ✅ | | | |
| `/lol-random-side` | ✅ | | | |
| `/lol-role-roulette` | ✅ | ✅ | ✅ | ✅ |

- Add Reactions: `/lol-role-roulette` でロール絵文字をリアクションとして追加するために必要
- Read Message History: リアクションユーザー取得 API（`GET /channels/{id}/messages/{id}/reactions/{emoji}`）に必要
- Manage Messages: 全リアクション削除 API（`DELETE /channels/{id}/messages/{id}/reactions`）に必要。リセットボタンで使用

### 格闘ゲーム（`/fighting-*`）

格ゲーのチーム戦運営向け。

- `/fighting-team-order`: チーム戦（2v2/3v3/5v5）の出場順を両チーム同時に発表する

| コマンド | Send Messages | Add Reactions | Read Message History | Manage Messages |
| :--- | :---: | :---: | :---: | :---: |
| `/fighting-team-order` | ✅ | | | |

### チーム活動スケジュール調整（`/team-schedule-*`）

チーム単位で活動予定を擦り合わせる Web ツール（[チーム活動 スケジュール調整](https://discord-janken.vercel.app/team_schedules)）への入口コマンド。

- `/team-schedule-login`: スケジュール調整ページのログイン用リンクを本人にだけ（ephemeral）発行する。期限が切れても「リンクを再発行」ボタンで取り直せる
- `/team-schedule-invite`: 自分が管理者（master/admin）のチームへの参加募集ボタンを投稿する。管理チームが1つならそのチームの公開メッセージを投稿、複数なら自分にだけ見えるメニューで選んでから投稿。押した人は「参加する」ボタンで Discord ログイン不要で加入でき、参加後にログイン用リンクが渡される

| コマンド | Send Messages | Add Reactions | Read Message History | Manage Messages |
| :--- | :---: | :---: | :---: | :---: |
| `/team-schedule-login` | ✅ | | | |
| `/team-schedule-invite` | ✅ | | | |

### ユーザー汎用（`/user-*`）

ゲームを問わず使える汎用コマンド。

- `/user-timer`: 指定時刻にメッセージを送信するタイマーを設定する
- `/user-common-message`: みんなで編集できる共有メッセージを投稿する
- `/user-feedback`: 不具合・要望などのフィードバックを送信する（Google Sheets に保存）
- `/user-mention-reactors` `(一部実装中)`: 指定メッセージに特定リアクションをつけた人へメンションを送る。リアクションユーザー取得のレートリミット課題（#196）と拡張機能（セレクトメニュー／モーダル）が未完成

| コマンド | Send Messages | Add Reactions | Read Message History | Manage Messages |
| :--- | :---: | :---: | :---: | :---: |
| `/user-timer` | ✅ | | | |
| `/user-common-message` | ✅ | | | |
| `/user-feedback` | ✅ | | | |
| `/user-mention-reactors` | ✅ | | ✅ | |

### 開発者用（`/dev-*`）

開発・動作確認用（一般利用者は使わない）。

- `/dev-echo`: 入力したテキストを Bot がそのまま送信する
- `/dev-test`: 実装の動作確認用

| コマンド | Send Messages | Add Reactions | Read Message History | Manage Messages |
| :--- | :---: | :---: | :---: | :---: |
| `/dev-echo` | ✅ | | | |
| `/dev-test` | ✅ | | ✅ | |
