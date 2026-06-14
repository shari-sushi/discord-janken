# 環境設定・よく使うコマンド

## 環境変数

以下の環境変数が必要です（`.env.local` に設定）:

**Discord関連:**

- `DISCORD_PUBLIC_KEY`: Discord Bot の公開鍵
- `DISCORD_APPLICATION_ID`: Discord Application ID
- `DISCORD_BOT_TOKEN`: Discord Bot トークン
- `DISCORD_WEB_HOOK_URL`: Discord Webhook URL

**認証・アクセス制御:**

- `ALLOWED_USERS`: Web API認証用のユーザー名とパスワード（形式: `user1:pass1,user2:pass2`）
- `ADMIN_PASSWORD`: 管理者パスワード
- `WEB_API_SECRET`: Web API の秘密鍵

**Riot Games API:**

- `RIOT_API_KEY`: Riot Games API キー（[Developer Portal](https://developer.riotgames.com/) で取得）
  - `/lol/all-ranked` ページのサモナーランク検索に使用
  - 開発キーは24時間で失効するため、本番環境では本番キーを申請すること
- `RIOT_API_REVALIDATE_SECONDS`: Riot APIレスポンスのキャッシュ秒数（省略可）
  - 未設定時のデフォルト: 本番環境 `300`（5分）、それ以外 `1`（1秒）
  - ローカル開発時は `.env.local` への記載不要（自動で1秒になる）

**データベース:**

- `REDIS_URL`: Redis接続URL

**Google Sheets:**

- `GOOGLE_SERVICE_ACCOUNT_JSON`: Google サービスアカウントの認証情報 (JSON文字列)
- `GOOGLE_SHEET_URL`: 保存先のスプレッドシートURL

**アプリURL:**

- `APP_URL`: 本アプリの公開URL（末尾スラッシュなし）
  - 例: `https://discord-janken.vercel.app`
  - QStash のコールバック先URL生成に使用（`${APP_URL}/api/web/timer/execute`）
  - Vercel の環境変数にも設定が必要
  - ローカル開発でタイマー機能をテストする場合は ngrok 等のトンネルURLを設定する

**QStash (非同期キュー):**

- `QSTASH_URL`: QStash エンドポイントURL
- `QSTASH_TOKEN`: QStash 認証トークン
- `QSTASH_CURRENT_SIGNING_KEY`: QStash 署名検証キー（現在）
- `QSTASH_NEXT_SIGNING_KEY`: QStash 署名検証キー（次回更新用）

## よく使うコマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド (本番環境ではコマンド登録も実行される)
npm run build

# Discordコマンドを手動登録
npx tsx app/api/discord/command/register.ts

# ESLint実行
npm run lint
```
