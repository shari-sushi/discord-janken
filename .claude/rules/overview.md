# プロジェクト概要

## LoL Custom Tool (Discord Bot)

League of Legends（LoL）のカスタムゲームを円滑に運営するためのDiscord botです。

## 現在実装されている機能

### League of Legends用: `/lol-`

- **LTKプロテクトルール機能** (`/lol-new-match`)
  - ブルーチーム・レッドチームがそれぞれプロテクトするチャンピオンを入力し、同時発表
  - Redis に試合ID単位でデータを保存

### 格ゲー用：`/fighting-`

- **格ゲーチーム順同時発表機能** (`/fighting-team-order`)
  - 格ゲーチーム戦の出場順を両チーム同時に発表（2v2, 3v3, 5v5対応）

### ユーザー汎用機能：`/user-`

- **タイマー機能** (`/user-timer`)
  - 指定時刻にメッセージを送信するタイマーを設定
  - QStashで遅延実行を実現

- **共有メッセージ編集機能** (`/user-common-message`)
  - 複数人で編集できる共有メッセージを投稿

- **フィードバック機能** (`/user-feedback`)
  - ユーザーからのフィードバック（不具合、意見・要望、操作ミスの体験、その他）を収集
  - Google Sheets に保存

### 開発者汎用機能:`/dev-`

- **エコーコマンド** (`/dev-echo`)
  - 開発・テスト用コマンド

- **開発者テストコマンド** (`/dev-test`)
  - 実装の動作確認用コマンド

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router)
- **言語**: TypeScript
- **Discord API**: `discord-interactions` ライブラリ
- **データベース**: Redis
- **データ保存**: Google Sheets API (フィードバック用)
- **非同期キュー**: QStash (タイマー機能)
- **デプロイ先**: Vercel
- **その他**: uuid (ID生成), dotenv (環境変数管理)

## プロジェクト構造

```txt
my-app/
├── app/
│   ├── domains/                      # ドメイン知識（型定義 + ロジック）
│   │   ├── lol/
│   │   │   ├── types.ts              # 型定義（フロント/サーバー共通）
│   │   │   ├── _server/              # サーバー専用ロジック
│   │   │   │   ├── redisKeys.ts      # Redisキー生成
│   │   │   │   └── validators.ts     # バリデーション・パース
│   │   │   └── _client/              # クライアント専用ロジック
│   │   │       └── opggApiClient.ts  # op.gg機能のWeb APIクライアント
│   │   ├── fighting/
│   │   │   ├── types.ts              # 型定義（フロント/サーバー共通）
│   │   │   └── _server/              # サーバー専用ロジック
│   │   │       ├── redisKeys.ts      # Redisキー生成
│   │   │       ├── validators.ts     # 型ガード
│   │   │       └── ...               # その他（定数定義等）
│   │   └── user/
│   │       ├── feedback/
│   │       │   └── types.ts          # フィードバック型定義
│   │       └── commonMessage/
│   │           └── _server/
│   │               └── constants.ts  # Discord制限値
│   │
│   ├── _client/                      # クライアント専用（ルーティング対象外）
│   │   └── lib/
│   │       └── apiClient/
│   │           ├── crud.ts           # Web API クライアント
│   │           └── types.ts          # API型定義
│   │
│   ├── _server/                      # サーバー専用（ルーティング対象外）
│   │   ├── lib/                      # 外部サービス統合ライブラリ
│   │   │   ├── auth.ts               # 認証ヘッダー検証
│   │   │   ├── discord/
│   │   │   │   └── api.ts            # Discord REST API通信
│   │   │   └── ...                   # その他（Google Sheets, QStash, Redis, セッション管理等）
│   │   └── util/                     # 横断的ユーティリティ
│   │       ├── commands.ts           # 全コマンド名・アクション定数
│   │       └── newId.ts              # UUID生成
│   │
│   ├── api/
│   │   ├── discord/                  # Discord Bot API
│   │   │   ├── command/              # Discordコマンド実装
│   │   │   │   ├── register.ts      # コマンド登録スクリプト
│   │   │   │   ├── dev/              # 開発・テスト用
│   │   │   │   │   ├── echo.ts
│   │   │   │   │   └── developers-test.ts
│   │   │   │   ├── lol/              # LoL関連
│   │   │   │   │   └── newMatch.ts
│   │   │   │   ├── user/             # ユーザー向け汎用
│   │   │   │   │   ├── feedback.ts
│   │   │   │   │   ├── timer.ts
│   │   │   │   │   └── ...           # その他（共有メッセージ等）
│   │   │   │   └── fighting-game/    # 格ゲー関連
│   │   │   │       └── teamOrder.ts
│   │   │   ├── util/                 # Discord専用ユーティリティ
│   │   │   │   ├── getComponentValue.ts
│   │   │   │   └── protectMessageComponents.ts
│   │   │   ├── route.ts              # Interaction受信エンドポイント
│   │   │   └── types.ts              # Discord型定義
│   │   │
│   │   └── web/                      # Web API（ブラウザ・外部連携用）
│   │       ├── _handlers/            # 共通ハンドラー
│   │       │   └── redisOperations.ts
│   │       ├── auth/                 # 認証
│   │       │   ├── login/route.ts
│   │       │   └── logout/route.ts
│   │       ├── crud/                 # Redis CRUD操作（開発者用）
│   │       │   ├── create/route.ts
│   │       │   ├── get/route.ts
│   │       │   └── ...               # その他（update, delete）
│   │       ├── lol/                  # LoL関連Web API
│   │       │   └── matches/
│   │       │       ├── route.ts      # 試合作成
│   │       │       └── reminder-execute/
│   │       │           └── route.ts  # タイマーコールバック
│   │       └── timer/                # 汎用タイマーコールバック
│   │           └── execute/route.ts
│   │
│   ├── lol/                          # LoL向けWebページ
│   │   └── opgg-multi-link/          # op.gg マルチサーチリンク生成
│   │       ├── page.tsx              # Suspenseラッパーのみ（薄いエントリーポイント）
│   │       ├── _types.ts             # UIステート型（Player, Mode, TeamType）
│   │       ├── _utils.ts             # URL生成・Basic認証ヘルパー
│   │       └── _components/          # このページ専用コンポーネント群
│   │           ├── OpggMultiLinkPage.tsx   # 状態管理・レイアウト
│   │           ├── InputMode.tsx           # 入力モード
│   │           ├── TeamSearchMode.tsx      # チーム検索モード
│   │           ├── TeamLoginMode.tsx       # チームログインモード
│   │           ├── SettingsSection.tsx     # 設定セクション
│   │           ├── PlayerListAndUrl.tsx    # プレイヤーリスト+URL表示
│   │           ├── RegisterTeamOverlay.tsx # チーム登録オーバーレイ
│   │           └── CopyButton.tsx          # コピーボタン
│   ├── login/                        # ログインページ
│   │   └── page.tsx
│   ├── page.tsx                      # トップページ（開発者用Redis管理UI）
│   └── layout.tsx
│
└── package.json
```

## 参考リンク

- [Discord Developer Portal](https://discord.com/developers/docs)
- [Discord Interactions API](https://discord.com/developers/docs/interactions/receiving-and-responding)
- [Discord Message Components](https://discord.com/developers/docs/interactions/message-components)
- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel Documentation](https://vercel.com/docs)
