# プロジェクト概要

## LoL Custom Tool (Discord Bot)

League of Legends（LoL）のカスタムゲームを円滑に運営するためのDiscord botです。

## 現在実装されている機能

- **LTKプロテクトルール機能** (`/lol-new-protect`)
  - ブルーチーム・レッドチームがそれぞれプロテクトするチャンピオンを入力し、同時発表
  - Redis に試合ID単位でデータを保存

- **フィードバック機能** (`/lol-feedback`)
  - ユーザーからのフィードバック（不具合、意見・要望、操作ミスの体験、その他）を収集
  - Google Sheets に保存

- **エコーコマンド** (`/lol-echo`)
  - 開発・テスト用コマンド

## 今後実装予定の機能

- `lol-new-protect`はprotect専用にし、web api`lol/matches`と同じコマンド
- 格ゲー用の先方、中堅、大将みたいなロースター同時発表コマンド
- メッセージを複数人で編集できるコマンド
- メンバー管理(メンバー登録、メンバーのレート確認、メンバーのカスタム参加希望申請、ツール内レート確認)
- チーム振り分け（自動割り当て、振り分け後にvc移動ボタン）
- レーティングシステム
- 試合結果送信機能
- 個人戦績確認機能

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router)
- **言語**: TypeScript
- **Discord API**: `discord-interactions` ライブラリ
- **データベース**: Redis (旧Vercel KV)
- **データ保存**: Google Sheets API (フィードバック用)
- **デプロイ先**: Vercel
- **その他**: uuidv4 (ID生成), dotenv (環境変数管理)

## プロジェクト構造

```txt
my-app/
├── app/
│   ├── api/
│   │   ├── discord/
│   │   │   ├── application-command/     # Discordコマンドの実装
│   │   │   │   ├── dev/                 # 開発・テスト用コマンド
│   │   │   │   │   ├── echo.ts
│   │   │   │   │   └── developers-test.ts
│   │   │   │   ├── lol/                 # LoL関連コマンド
│   │   │   │   │   └── newProtect.ts
│   │   │   │   ├── user/                # ユーザー向け汎用コマンド
│   │   │   │   │   ├── feedback.ts
│   │   │   │   │   └── timer.ts
│   │   │   │   └── fighting-game/       # 格ゲー関連コマンド（未実装）
│   │   │   ├── register-commands.ts     # Discord側へのコマンド登録スクリプト
│   │   │   ├── route.ts                 # メインのDiscord Interaction受信エンドポイント
│   │   │   └── types.ts                 # Discord関連の型定義
│   │   └── web/                         # Web API (CRUD操作・認証など)
│   │       ├── auth/                    # 認証関連
│   │       │   ├── login/route.ts
│   │       │   └── logout/route.ts
│   │       └── timer/                   # QStashコールバック
│   │           └── execute/route.ts
│   ├── libs/
│   │   ├── redis/redis.ts               # Redis操作のラッパー
│   │   ├── discord/Api.ts               # Discord へのリクエスト処理（メッセージ送信・編集など）
│   │   ├── googleSheets.ts              # Google Sheets API操作
│   │   └── session.ts                   # セッション管理
│   ├── util/
│   │   ├── commands.ts                  # コマンド名や定数定義
│   │   └── newId.ts                     # UUID生成ユーティリティ
│   ├── page.tsx                         # フロントページ 今は開発者用
│   └── layout.tsx
└── package.json
```

## 参考リンク

- [Discord Developer Portal](https://discord.com/developers/docs)
- [Discord Interactions API](https://discord.com/developers/docs/interactions/receiving-and-responding)
- [Discord Message Components](https://discord.com/developers/docs/interactions/message-components)
- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel Documentation](https://vercel.com/docs)
