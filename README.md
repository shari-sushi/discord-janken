# LoL Custom Tool (Discord Bot)

※ TODO: READMEちゃんとする

## デプロイ・ブランチ運用

- `main` へ push/merge → 本番へ自動デプロイ、コマンドを PUT で完全更新
- 非 `main` へ push → 各ブランチへ自動デプロイ & guild command に登録（差分を POST）
  - コマンド定義の調整は反映されないので注意
- `develop` へ push/merge → Discord Bot canary 版に自動反映。サンドボックスチャンネルで動作確認可能。気軽に push してよい

※guild command は即時反映、global command はコマンド登録の反映に最大1時間かかる

## Bot 必要権限

コマンドごとに必要な Discord Bot パーミッションを示します。

Bot をサーバーに追加する際は、使用するコマンドに対応した権限を付与してください。

### コマンド別パーミッション一覧

| コマンド | Send Messages | Add Reactions | Read Message History | Manage Messages |
| :--- | :---: | :---: | :---: | :---: |
| `/lol-new-match` | ✅ | | | |
| `/lol-random-side` | ✅ | | | |
| `/lol-role-roulette` | ✅ | ✅ | ✅ | ✅ |
| `/fighting-team-order` | ✅ | | | |
| `/user-timer` | ✅ | | | |
| `/user-feedback` | ✅ | | | |
| `/user-common-message` | ✅ | | | |
| `/dev-echo` | ✅ | | | |
| `/dev-test` | ✅ | | ✅ | |

> `View Channel` はすべてのコマンドで必要です（表から省略）。

### パーミッション用途メモ

- **Add Reactions**: `/lol-role-roulette` でロール絵文字をリアクションとして追加するために必要
- **Read Message History**: リアクションユーザー取得 API（`GET /channels/{id}/messages/{id}/reactions/{emoji}`）に必要
- **Manage Messages**: 全リアクション削除 API（`DELETE /channels/{id}/messages/{id}/reactions`）に必要。リセットボタンで使用
- **Send Messages in Threads**: スレッド内で使用する場合は追加で必要
