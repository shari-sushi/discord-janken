# Redis CRUD操作画面 実装計画

**作成日**: 2026-01-31
**バージョン**: v1
**関連ドキュメント**: [20260131-v1.md](./20260131-v1.md) (Redis CRUD Web API 実装計画)

## 1. 概要

Redis CRUD Web APIを操作するためのフロントエンド画面を `my-app/app/page.tsx` に実装します。

### 目的
- Redis CRUD APIの動作確認を容易にする
- ブラウザからKey/Valueの操作を直感的に実行できるようにする
- 各操作の結果を画面上で確認できるようにする

### 技術スタック
- Next.js App Router (Client Component)
- React Hooks (useState)
- TypeScript
- Tailwind CSS (既存スタイル)

### 実装するCRUD操作
- **CREATE**: 新しいKey/Valueペアを作成
- **GET**: 指定したKeyの値を取得
- **UPDATE**: 既存のKeyの値を更新
- **DELETE**: 指定したKeyを削除

## 2. ディレクトリ構造

```
my-app/
├── types/
│   └── api.ts                    # API型定義（新規作成）
├── libs/
│   └── redisCrudApi.ts          # API呼び出し関数（新規作成）
└── app/
    └── page.tsx                  # メイン画面（改修）
```

## 3. 実装ステップ

### ステップ1: 型定義ファイルの作成

**ファイル**: `my-app/types/api.ts`

```typescript
// リクエスト型
export interface CreateRequest {
  key: string;
  value: string;
}

export interface GetRequest {
  key: string;
}

export interface UpdateRequest {
  key: string;
  value: string;
}

export interface DeleteRequest {
  key: string;
}

// レスポンス型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreateResponse {
  key: string;
  created: boolean;
}

export interface GetResponse {
  key: string;
  value: string | null;
  exists: boolean;
}

export interface UpdateResponse {
  key: string;
  updated: boolean;
}

export interface DeleteResponse {
  key: string;
  deleted: boolean;
}
```

### ステップ2: 環境変数の確認

`.env.local` に以下が設定されていることを確認：

```env
NEXT_PUBLIC_WEB_API_SECRET=your-secret-key
```

**注意**: クライアント側で使用するため `NEXT_PUBLIC_` プレフィックスが必須です。

### ステップ3: API呼び出し関数の実装

**ファイル**: `my-app/libs/redisCrudApi.ts`

```typescript
import type {
  CreateRequest,
  GetRequest,
  UpdateRequest,
  DeleteRequest,
  ApiResponse,
  CreateResponse,
  GetResponse,
  UpdateResponse,
  DeleteResponse,
} from "@/types/api"

const API_BASE = "/api/web/crud"
const API_SECRET = process.env.NEXT_PUBLIC_WEB_API_SECRET

if (!API_SECRET) {
  console.error("NEXT_PUBLIC_WEB_API_SECRET is not set")
}

async function fetchWithAuth<T>(
  endpoint: string,
  body: object
): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_SECRET}`,
    },
    body: JSON.stringify(body),
  })
  return await response.json()
}

export async function createData(
  key: string,
  value: string
): Promise<ApiResponse<CreateResponse>> {
  const body: CreateRequest = { key, value }
  return fetchWithAuth<CreateResponse>("/create", body)
}

export async function getData(
  key: string
): Promise<ApiResponse<GetResponse>> {
  const body: GetRequest = { key }
  return fetchWithAuth<GetResponse>("/get", body)
}

export async function updateData(
  key: string,
  value: string
): Promise<ApiResponse<UpdateResponse>> {
  const body: UpdateRequest = { key, value }
  return fetchWithAuth<UpdateResponse>("/update", body)
}

export async function deleteData(
  key: string
): Promise<ApiResponse<DeleteResponse>> {
  const body: DeleteRequest = { key }
  return fetchWithAuth<DeleteResponse>("/delete", body)
}
```

### ステップ4: page.tsx のUI実装

**ファイル**: `my-app/app/page.tsx`

#### UI構成

```
┌──────────────────────────────────────────┐
│ Redis CRUD 操作画面                       │
├──────────────────────────────────────────┤
│ Key:   [match:123:blueTeam:member      ] │
│ Value: [John Doe                       ] │
│                                          │
│ [CREATE] [GET] [UPDATE] [DELETE]         │
│                                          │
│ ──────────────────────────────────────── │
│ 操作結果:                                 │
│ ┌──────────────────────────────────────┐ │
│ │ {                                    │ │
│ │   "success": true,                   │ │
│ │   "data": {                          │ │
│ │     "key": "match:123:blueTeam:...", │ │
│ │     "value": "John Doe",             │ │
│ │     "exists": true                   │ │
│ │   }                                  │ │
│ │ }                                    │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

#### State管理

```typescript
const [key, setKey] = useState("")
const [value, setValue] = useState("")
const [result, setResult] = useState<string>("")
const [isLoading, setIsLoading] = useState(false)
```

#### イベントハンドラ

各CRUDボタンに対応するハンドラを実装：

1. **handleCreate**: `createData(key, value)` を呼び出し
2. **handleGet**: `getData(key)` を呼び出し
3. **handleUpdate**: `updateData(key, value)` を呼び出し
4. **handleDelete**: `deleteData(key)` を呼び出し

各ハンドラの共通処理：
- ローディング状態の管理
- APIレスポンスをJSON文字列に変換して表示
- エラーハンドリング（try-catch）

#### エラーハンドリング

```typescript
try {
  setIsLoading(true)
  const response = await createData(key, value)
  setResult(JSON.stringify(response, null, 2))
} catch (error) {
  setResult(`エラーが発生しました: ${error}`)
} finally {
  setIsLoading(false)
}
```

## 4. 画面仕様

### 入力フィールド

| フィールド | 説明 | 必須 | 例 |
|----------|------|------|-----|
| Key | Redisのキー | ○ | `match:123:blueTeam:member` |
| Value | Redisの値 | ○ (CREATE/UPDATE) | `John Doe` |

### ボタン

| ボタン | 機能 | 必要な入力 |
|--------|------|-----------|
| CREATE | 新規作成 | Key, Value |
| GET | 取得 | Key |
| UPDATE | 更新 | Key, Value |
| DELETE | 削除 | Key |

### 結果表示エリア

- JSONフォーマットで整形表示（`JSON.stringify(result, null, 2)`）
- 成功時: レスポンスデータを表示
- エラー時: エラーメッセージを表示
- ローディング中: 「処理中...」などの表示（オプション）

## 5. デザイン方針

- **シンプルで機能的**: 動作確認用のため装飾は最小限
- **既存スタイル踏襲**: 現在の page.tsx のTailwind CSSスタイルを踏襲
- **可読性重視**: 結果表示は等幅フォントでJSONを見やすく

### 色分け案（オプション）

- CREATE: 青系
- GET: 緑系
- UPDATE: オレンジ系
- DELETE: 赤系

## 6. 動作確認テストシナリオ

### 正常系フロー

1. **CREATE**
   - Key: `test:user:001`
   - Value: `{"name": "太郎"}`
   - 期待結果: `{ "success": true, "data": { "created": true } }`

2. **GET**
   - Key: `test:user:001`
   - 期待結果: `{ "success": true, "data": { "exists": true, "value": "{\"name\": \"太郎\"}" } }`

3. **UPDATE**
   - Key: `test:user:001`
   - Value: `{"name": "次郎"}`
   - 期待結果: `{ "success": true, "data": { "updated": true } }`

4. **GET（更新確認）**
   - Key: `test:user:001`
   - 期待結果: 更新後の値が取得できる

5. **DELETE**
   - Key: `test:user:001`
   - 期待結果: `{ "success": true, "data": { "deleted": true } }`

6. **GET（削除確認）**
   - Key: `test:user:001`
   - 期待結果: `{ "success": true, "data": { "exists": false, "value": null } }`

### エラーケース

1. **空のKey**: バリデーションエラー
2. **CREATE時に既存キー**: 409エラー
3. **UPDATE時に存在しないキー**: 404エラー
4. **環境変数未設定**: API認証エラー

## 7. セキュリティ考慮事項

### 環境変数の扱い

- `NEXT_PUBLIC_WEB_API_SECRET` はクライアント側に露出される
- **開発・検証環境専用**として使用
- 本番環境では別の認証機構を検討

### 入力バリデーション

- **キー**: 最大256文字、`[a-zA-Z0-9_:-]+` のみ許可
- **値**: 最大10MB
- APIサーバー側でバリデーションされるため、クライアント側は最小限

### ユーザー入力とコロン

- Redisのキー設計で `:` を階層区切りとして使用
- ユーザー入力をキーに含める場合は `:` を除去/置換する
- 例: `userName.replace(/:/g, '-')`

## 8. 実装チェックリスト

- [ ] `my-app/types/api.ts` を作成
- [ ] `my-app/libs/` ディレクトリを作成
- [ ] `my-app/libs/redisCrudApi.ts` を作成
- [ ] `.env.local` に `NEXT_PUBLIC_WEB_API_SECRET` を設定
- [ ] `my-app/app/page.tsx` のUI改修
  - [ ] key, value 入力フィールド
  - [ ] CREATE, GET, UPDATE, DELETE ボタン
  - [ ] 結果表示エリア
  - [ ] state管理（useState）
  - [ ] 各ボタンのイベントハンドラ
  - [ ] エラーハンドリング
- [ ] 動作確認（正常系フロー）
- [ ] 動作確認（エラーケース）

## 9. 今後の拡張案

- ローディングスピナーの追加
- キーの履歴機能（LocalStorage）
- キーのパターン一覧取得（KEYS コマンド）
- バッチ削除機能
- JSONエディタの導入（値の編集を容易に）
- レスポンスの構文ハイライト

## 10. 注意事項

- この画面は**開発・検証用**です
- デザインはシンプルで機能性重視
- API認証情報はクライアント側に露出されます
- 本番環境での使用は推奨されません