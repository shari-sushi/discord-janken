---
paths: [my-app/app/api/web/**/*.ts, my-app/app/api/auth/**/*.ts]
---

# Web API・認証ルール

## Web API認証（`/api/web/*` エンドポイント）

Web API へのアクセスは、ユーザー名+パスワード認証により保護されています。
**2つの認証方式**をサポートしています。

## 方式1: Basic認証（GAS向け・推奨）

毎回のリクエストにユーザー名とパスワードを含めます。GASなど自動化スクリプトでの使用に最適です。

**使用例（curl）:**

```bash
curl -X POST https://your-app.vercel.app/api/web/lol/matches \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n 'username:password' | base64)" \
  -d '{"guild_id":"123","channel_id":"456","isProtect":true}'
```

**GAS（Google Apps Script）から使用する場合:**

```javascript
function getBasicAuthHeader() {
  const props = PropertiesService.getScriptProperties()
  const username = props.getProperty("USERNAME")
  const password = props.getProperty("PASSWORD")
  const credentials = Utilities.base64Encode(`${username}:${password}`)
  return `Basic ${credentials}`
}

function createMatch() {
  const response = UrlFetchApp.fetch("https://your-app.vercel.app/api/web/lol/matches", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getBasicAuthHeader(),
    },
    payload: JSON.stringify({
      guild_id: "YOUR_GUILD_ID",
      channel_id: "YOUR_CHANNEL_ID",
      isProtect: true,
    }),
  })

  const result = JSON.parse(response.getContentText())
  Logger.log("試合ID: " + result.match_id)
}
```

## 方式2: Bearer Token認証（ブラウザ向け）

ログインしてセッショントークンを取得し、以降のリクエストで使用します。

**認証フロー:**

1. `/api/auth/login` にユーザー名とパスワードを送信
2. セッショントークン（64文字の16進数）を取得
3. 以降のリクエストで `Authorization: Bearer {token}` ヘッダーに付与

**セッション仕様:**

- **有効期限**: 7日間
- **自動延長**: API使用のたびに7日間延長（トークンは不変）
- **保存場所**: Redis（キー: `session:{token}`）
- **保存データ**: ユーザー名、作成日時、最終アクセス日時

**使用例（curl）:**

```bash
# 1. ログイン
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}'
# → {"success":true,"token":"abc123..."}

# 2. API呼び出し
curl -X POST https://your-app.vercel.app/api/web/lol/matches \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer abc123..." \
  -d '{"guild_id":"123","channel_id":"456","isProtect":true}'

# 3. ログアウト
curl -X POST https://your-app.vercel.app/api/auth/logout \
  -H "Authorization: Bearer abc123..."
```

## ユーザー管理

環境変数 `ALLOWED_USERS` でユーザーを管理します：

```bash
# .env.local
ALLOWED_USERS=user1:pass456,user2:pass789
```

- 形式: `username1:password1,username2:password2,...`
- ユーザー追加・削除時は環境変数を更新して再デプロイ

## Discord Bot認証

Discord APIへのアクセスは、Bot Token（`DISCORD_BOT_TOKEN`）を使用します。これは Web API認証とは独立しています。

## LoL関連Web APIエンドポイント

### POST `/api/web/lol/matches`

新しい試合を作成し、Discordチャンネルにメッセージを送信します。

**認証**: Basic認証 または Bearer Token認証が必要

**リクエストボディ:**

```typescript
{
  guild_id: string        // Discord サーバーID
  channel_id: string      // Discord チャンネルID
  isProtect?: boolean     // プロテクト機能を有効化（デフォルト: false）
  isRoleSelect?: boolean  // ロール選択機能を有効化（デフォルト: false）
  reminder?: {
    at: string           // リマインダー時刻（"HH:MM" または "M分後"）
    message?: string     // リマインダーメッセージ（オプション）
  }
}
```

**レスポンス:**

```typescript
{
  success: true
  match_id: string          // 生成された試合ID
  message_id: string        // Discord メッセージID
  reminder_registered?: boolean  // リマインダー登録の成否
}
```

### POST `/api/web/lol/matches/reminder-execute`

**認証**: QStash署名検証（自動実行用エンドポイント）

タイマー作動時に試合の現在状況を通知するコールバックエンドポイント。QStashから自動的に呼び出されます。

**重要な仕様:**

- 両チームが記入済みの場合は通知を送らない（無駄な通知を防ぐ）
- 未記入チームがある場合、試合の現在状況（Embed含む）を表示
- Discord の仕様上、チャンネル全体に通知される（特定チームのみへの通知は不可）

**ペイロード:**

```typescript
{
  matchId: string
  channelId: string
  guildId: string
  message?: string      // タイマー設定時のメッセージ
  createdBy?: string    // タイマー設定者のユーザーID
}
```

**処理フロー:**

1. QStash署名検証
2. メタデータ取得
3. 両チームデータ一括取得（MGET使用）
4. 両チーム完了判定（記入済みの場合は早期リターン）
5. 試合の現在状況を取得（`getMatchStatusMessage()`）
6. Discord Webhookでメッセージ送信
