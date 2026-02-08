# LoL Custom Tool (Discord Bot)

## プロジェクト概要

League of Legends（LoL）のカスタムゲームを円滑に運営するためのDiscordボットツールです。

### 現在実装されている機能

- **LTKプロテクトルール機能** (`/lol-new-protect`)
  - 青チーム・赤チームがそれぞれプロテクトするチャンピオンを登録
  - Redis に試合ID単位でデータを保存

- **フィードバック機能** (`/lol-feedback`)
  - ユーザーからのフィードバック（不具合、意見・要望、操作ミスの体験、その他）を収集
  - Google Sheets に保存

- **エコーコマンド** (`/lol-echo`)
  - 開発・テスト用コマンド

### 今後実装予定の機能

- メンバー管理(メンバー登録、メンバーのレート確認、メンバーのカスタム参加希望申請、ツール内レート確認)
- チーム振り分け（自動割り当て、振り分け後にvc移動ボタン）
- レーティングシステム
- 試合結果送信機能
- 個人戦績確認機能

---

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router)
- **言語**: TypeScript
- **Discord API**: `discord-interactions` ライブラリ
- **データベース**: Redis (旧Vercel KV)
- **データ保存**: Google Sheets API (フィードバック用)
- **デプロイ先**: Vercel
- **その他**: uuidv4 (ID生成), dotenv (環境変数管理)

---

## プロジェクト構造

```txt
my-app/
├── app/
│   ├── api/
│   │   ├── discord/
│   │   │   ├── application-command/     # Discordコマンドの実装
│   │   │   │   ├── echo.ts              # エコーコマンド
│   │   │   │   ├── feedback.ts          # フィードバックコマンド
│   │   │   │   └── newProtect.ts        # LTKプロテクトルール開始コマンド
│   │   │   ├── register-commands.ts     # Discord側へのコマンド登録スクリプト
│   │   │   ├── route.ts                 # メインのDiscord Interaction受信エンドポイント
│   │   │   └── types.ts                 # Discord関連の型定義
│   │   ├── web/                          # Web API (CRUD操作など)
│   │   └── auth/                         # 認証関連
│   ├── libs/
│   │   ├── redis/redis.ts               # Redis操作のラッパー
│   │   ├── googleSheets.ts              # Google Sheets API操作
│   │   └── session.ts                   # セッション管理
│   ├── util/
│   │   ├── commands.ts                  # コマンド名や定数定義
│   │   └── newId.ts                     # UUID生成ユーティリティ
│   ├── page.tsx                         # フロントページ
│   └── layout.tsx
└── package.json
```

---

## 主要な仕組み

### Discord Interactionの処理フロー

1. **Discordからのリクエスト受信** (`app/api/discord/route.ts`)
   - 署名検証 (Ed25519)
   - インタラクションタイプに応じて処理を分岐
     - `PING`: Pong応答
     - `APPLICATION_COMMAND`: スラッシュコマンド実行
     - `MESSAGE_COMPONENT`: ボタンクリックやセレクトメニュー操作
     - `MODAL_SUBMIT`: モーダル送信

2. **コマンド実行**
   - `/lol-new-protect`: 試合IDを生成し、青・赤チーム選択ボタンを表示
   - `/lol-feedback`: フィードバック種類選択メニューを表示
   - `/lol-echo`: 入力をそのまま返す

3. **インタラクション処理**
   - ボタンクリック → モーダル表示
   - モーダル送信 → Redisに保存 & 確認メッセージ表示
   - 確認ボタン → Redisから現在の登録状況を取得して表示

### データ保存

- **Redis**: LTKプロテクトルールのチャンピオン登録データ
  - キー形式: `protect:{matchId}:{team}_team`
  - 値: チャンピオン名の文字列

- **Google Sheets**: フィードバックデータ
  - guildId, memberId, name, type, content を記録

---

## 開発ガイドライン

### バイブコーディングのアプローチ

このプロジェクトでは「バイブコーディング」スタイルで開発を進めます：

1. **要件定義フェーズ**: 開発者と Claude で機能の仕様を相談・決定
2. **実装フェーズ**: Claude がコーディングを担当
3. **レビュー・調整**: 動作確認後、必要に応じて修正

### コーディング規約

#### TypeScriptコード

- **言語**: TypeScript (厳格な型定義を推奨)
- **コメント**: 複雑なロジックには日本語コメントを追加
- **命名規則**:
  - ファイル名: camelCase (例: `newProtect.ts`)
  - 定数: UPPER_SNAKE_CASE (例: `CLIENT_ACTIONS`, `COMMANDS`)
  - 関数: camelCase (例: `saveTeamAndCheckOther`)
- **コマンド名のプレフィックス**: `lol-` を使用 (例: `/lol-new-protect`)
- **過度な抽象化を避ける**: シンプルで読みやすいコードを優先
- **エラーハンドリング**: try-catch で適切にエラーを処理し、ユーザーにわかりやすいメッセージを返す

#### Markdownファイル

- **Linterの適用**: すべてのMarkdownファイルは`markdownlint`のルールに準拠すること
- **AI（Claude）への注意**: Markdownファイルを編集する際は、必ず`markdownlint`の警告を出さないように記述すること

#### 実行計画書

- **保存場所**: `VIBES/plan/`
- **命名規則**: `YYYYMMDD-{その日付の何個目か}-{日本語で簡単な作業内容}.md`
  - 例: `20260208-1-Redisリファクタ.md`、`20260208-2-フィードバック機能修正.md`

#### ファイル構造の原則

##### 1. 機能単位でのファイル分割

- **原則**: 1つの Discord コマンド機能 = 1ファイル
- **場所**: `app/api/discord/application-command/` 配下
- **命名**: コマンド名と同じ (例: `/lol-new-protect` → `newProtect.ts`)

##### 2. 1ファイル内に含める処理

各コマンド機能ファイルには、以下の全処理を含める：

- ✅ コマンド初期表示（APPLICATION_COMMAND）
- ✅ ボタン/選択メニュー処理（MESSAGE_COMPONENT）
- ✅ モーダル送信処理（MODAL_SUBMIT）
- ✅ その機能専用のヘルパー関数

##### 3. export の方針

- **コマンド関数**: 必ず export（`route.ts` から呼ばれる）
- **ハンドラー関数**: 必ず export（`route.ts` から呼ばれる）
- **内部ヘルパー関数**: export しない（ファイル内でのみ使用）

##### 4. route.ts の責務

`route.ts` は以下のみを担当：

- ✅ Discord署名検証
- ✅ インタラクションタイプの判定
- ✅ 適切なハンドラー関数の呼び出し

`route.ts` が行わないこと：

- ❌ ビジネスロジック
- ❌ Discord レスポンスの組み立て
- ❌ データベース操作

### Discord API 抜粋

- **インタラクションタイプ**: `DISCORD_INTERACTION_TYPE` で定義
  - 公式ドキュメント: <https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object-interaction-type>
- **レスポンスタイプ**:
  - `type: 1` → Pong
  - `type: 4` → メッセージ返信
  - `type: 9` → モーダル表示
- **コンポーネント**:
  - `type: 1` → Action Row (コンテナ)
  - `type: 2` → Button
  - `type: 3` → String Select Menu
  - `type: 4` → Text Input (モーダル内)
  - 公式ドキュメント: <https://discord.com/developers/docs/interactions/message-components>
- **Ephemeralメッセージ**: `flags: 64` で送信者のみに表示

### 環境変数

以下の環境変数が必要です（`.env.local` に設定）:

- `DISCORD_PUBLIC_KEY`: Discord Bot の公開鍵
- `DISCORD_APPLICATION_ID`: Discord Application ID
- `DISCORD_BOT_TOKEN`: Discord Bot トークン
- Redis接続情報 (Vercel KV使用時は自動設定)
- Google Sheets API認証情報

---

## よく使うコマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド (本番環境ではコマンド登録も実行される)
npm run build

# Discordコマンドを手動登録
npx tsx app/api/discord/register-commands.ts

# ESLint実行
npm run lint
```

---

## デプロイ

- **プラットフォーム**: Vercel
- **自動デプロイ**: main ブランチへのプッシュで自動デプロイ
- **コマンド登録**: ビルド時に `VERCEL_ENV=production` の場合のみ自動実行

---

## 開発時の注意点

1. **Discord署名検証**: ローカル開発時はngrokなどでHTTPSエンドポイントを公開する必要あり
2. **Redis接続**: Vercel KVを使用。ローカルではRedis Cloudや別のRedisインスタンスが必要
3. **コマンド登録**: Discord側にスラッシュコマンドを登録しないと使用できない
4. **ビルド時のコマンド上書き注意**: 本番環境（`VERCEL_ENV=production`）でビルドすると自動的にDiscordコマンドが上書き登録される
5. **custom_id の長さ制限**: Discord の custom_id は100文字まで。クエリパラメータを含める場合は注意
6. **モーダルの制限**: モーダルは最大5つのAction Rowまで
7. **非同期処理**: Discord Interactionは3秒以内に応答する必要がある。重い処理は後続処理で対応

---

## トラブルシューティング

### コマンドが表示されない

→ `register-commands.ts` を実行してDiscord側にコマンドを登録

### Redisエラー

→ 環境変数が正しく設定されているか確認

### フィードバックが保存されない

→ Google Sheets APIの認証情報と権限を確認

---

## 参考リンク

- [Discord Developer Portal](https://discord.com/developers/docs)
- [Discord Interactions API](https://discord.com/developers/docs/interactions/receiving-and-responding)
- [Discord Message Components](https://discord.com/developers/docs/interactions/message-components)
- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel Documentation](https://vercel.com/docs)
