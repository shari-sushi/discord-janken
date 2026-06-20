# コーディング規約

## バイブコーディングのアプローチ

このプロジェクトでは「バイブコーディング」スタイルで開発を進めます：

1. **要件定義フェーズ**: 開発者と Claude で機能の仕様を相談・決定
2. **実装フェーズ**: Claude がコーディングを担当
3. **コーディング終了時**: 必ず以下を実施する
   - `npm run lint` を実行し、警告・エラーがないことを確認する
   - `npx tsc --noEmit` を実行し、TypeScriptの型エラーがないことを確認する
   - VSCode の保存時フォーマット（Prettier 等）と同等になるよう、インデント・改行・末尾スペースを整える
   - 環境変数を追加・削除・変更した場合は、`.claude/rules/setup.md` の環境変数一覧を必ず対応させる
4. **レビュー・調整**: 動作確認後、必要に応じて修正

## PR・issue 運用（GitHub）

ブランチ運用は **feature → `develop` → `main`** で、issue の auto-close は
**default ブランチ（`main`）向け PR でしか発火しない**。これを踏まえて:

### develop への push 禁止（厳守）

- **ユーザーが明示的に「develop に push」と指示しない限り、`develop` への push は禁止**。
  `git push origin develop` / `git push`（upstream が develop の状態）/ force-push を含め一切行わない。
- **文脈から「develop に入れてほしそう」と読み取れる場合でも禁止**。推測で push しない。
- 変更は必ず **feature ブランチを切ってそこへ commit / push** し、`develop` へは PR 経由で入れる。
- 既に develop へ直 push してしまった場合も、巻き戻し（reset + force-push）は破壊的操作なので
  **必ずユーザーに確認してから**実行する（勝手に force-push しない）。


- **feature → develop の PR**: その PR で完了させる issue を本文に `- close #N` の形式で**列挙**する
  （`#N` は GitHub 上で issue タイトルがリンク表示されるため、タイトルは書かない。develop base では `Closes #N` でも
  auto-close は発火しないので、ここでは close せず一覧として残す目的。develop→main PR を組むときの拾い漏れ防止）。
- **develop → main の PR**: 束ねた close予定 issue を `Closes #N` で本文に列挙する → main マージ時に auto-close される（手動 close 不要）。
- フォローアップとして**新規起票した issue は列挙しない**（その PR では閉じないため）。
- やむを得ず develop の時点で閉じる場合のみ `gh issue close #N -c "..."` で手動 close する。

## TypeScriptコード

### 基本方針

- **言語**: TypeScript
- **コメント**: 複雑なロジックには日本語コメントを追加
- **過度な抽象化を避ける**: シンプルで読みやすいコードを優先
- **エラーハンドリング**:
  - try-catch で適切にエラーを処理し、ユーザーにわかりやすいメッセージを返す
  - 認証認可ではリソースの存在を隠匿するために、必要に応じてクライアントには404を返す

### 環境変数の取得方法

環境変数は `app/_server/lib/env.ts` からインポートして使用する。

- 環境変数は`env.ts` に定義を追加し、使用場所でインポートする
- 必須の場合は `getRequiredEnv`、省略可能な場合は `getOptionalEnv` を使用する

### Discord型定義パッケージの使用方針

**採用パッケージ:**

- `discord-interactions` (v4.4.0以降)
  - Discord公式チームが提供するパッケージ
  - 署名検証機能（`verifyKey`）を使用
  - 基本的なenum型（`InteractionType`, `InteractionResponseType`, `MessageComponentTypes` など）を使用
  - コンポーネント型（`MessageComponent`, `ActionRow`, `Button` など）を使用

**独自型定義:**

- `discord-interactions` に含まれないため独自定義が必要
- `app/api/discord/types.ts` で必要最小限の型を独自定義

**将来的な検討事項:**

- `discord-api-types` の導入を再検討する際は、以下のデメリットに注意する
  - enum の重複によるエラーの可能性

### 命名規則

- **ファイル名**: camelCase (例: `newMatch.ts`)
- **定数**: UPPER_SNAKE_CASE (例: `CLIENT_ACTIONS`, `COMMANDS`)
- **関数**: camelCase (例: `saveTeamAndCheckOther`)
- **コマンド名のプレフィックス**: `lol-`, `user-`, `dev-`, `fighting-`

## ファイル構造の原則

### 1. 機能単位でのファイル分割

- **原則**: 1つの Discord コマンド機能 = 1ファイル
- **場所**: `app/api/discord/command/` 配下
- **命名**: コマンド名と同じ (例: `/lol-new-match` → `newMatch.ts`)

### 2. 1ファイル内に含める処理

各コマンド機能ファイルには、以下の全処理を含める：

- ✅ コマンド初期表示（APPLICATION_COMMAND）
- ✅ ボタン/選択メニュー処理（MESSAGE_COMPONENT）
- ✅ モーダル送信処理（MODAL_SUBMIT）
- ✅ その機能専用のヘルパー関数

### 3. export の方針

- **コマンド関数**: 必ず export（`route.ts` から呼ばれる）
- **ハンドラー関数**: 必ず export（`route.ts` から呼ばれる）
- **内部ヘルパー関数**: export しない（ファイル内でのみ使用）

### 4. route.ts の責務

`route.ts` は以下のみを担当：

- ✅ Discord署名検証
- ✅ インタラクションタイプの判定
- ✅ 適切なハンドラー関数の呼び出し

`route.ts` が行わないこと：

- ❌ ビジネスロジック
- ❌ Discord レスポンスの組み立て
- ❌ データベース操作

## ドメイン知識の配置

### ドメイン知識とは

以下をドメイン知識として扱います：

- **型定義**: ビジネスドメインのデータ構造（`ProtectMatchMeta`, `TeamOrderData` など）
- **Redisキー生成**: ドメイン固有のキー設計（`lol:matches:*`, `fighting:team-order:*` など）
- **バリデーション・型ガード**: ドメイン固有の制約・ルール
- **定数・設定値**: フォーマット定義、ポジション名、制限値など

### 配置ルール

**型定義（フロント/サーバー共通）:**

- 配置: `app/domains/{domain}/types.ts`
- 例: `app/domains/lol/types.ts`, `app/domains/fighting/types.ts`
- 将来的にWebダッシュボードを作成する可能性を考慮

**サーバー専用ロジック:**

- 配置: `app/domains/{domain}/_server/`
- ファイル例:
  - `redisKeys.ts`: Redisキー生成関数
  - `validators.ts`: バリデーション・型ガード
  - `constants.ts`: ドメイン固有の定数・設定値

**クライアント専用ロジック:**

- 配置: `app/domains/{domain}/_client/`
- 用途: Webページ（ブラウザ）から呼ばれるドメイン固有のAPI通信関数
- ファイル例:
  - `opggApiClient.ts`: op.gg機能のWeb APIクライアント（fetch/save/delete）

**ドメイン分類:**

- `lol/`: LoL関連機能（`/lol-*` コマンド）
- `fighting/`: 格ゲー関連機能（`/fighting-*` コマンド）
- `user/{feature}/`: ユーザー向け汎用機能（`/user-*` コマンド）
  - `feedback/`, `timer/`, `commonMessage/` など機能ごとに分割
- `dev/`: 開発者向け機能（`/dev-*` コマンド）

### 横断的ユーティリティ

以下は `app/_server/util/` に配置（全ドメイン共通）：

- `commands.ts`: 全コマンド名・アクション定数
- `newId.ts`: UUID生成

## Webページのファイル分割

### ページコンポーネントの分割ルール

ページが複数のコンポーネントを含む場合、`page.tsx` に全て詰め込まず以下の構成に分割する。

```txt
app/{feature}/
├── page.tsx              # Suspenseラッパーのみ（薄いエントリーポイント）
├── _types.ts             # UIステート専用の型（checked状態など、UI固有のもの）
├── _utils.ts             # このページ専用のユーティリティ関数
└── _components/          # このページ専用コンポーネント群（_ でルーティング対象外）
    ├── {PageName}.tsx    # 状態管理・レイアウトを担うメインコンポーネント
    └── {ComponentName}.tsx
```

### 型の配置基準

| 型の性質 | 配置先 |
| --- | --- |
| ドメインのデータ構造（APIレスポンス等） | `app/domains/{domain}/types.ts` |
| UIステート（checked, mode など画面固有） | `_types.ts`（ページ側） |

### ユーティリティの配置基準

| ユーティリティの性質 | 配置先 |
| --- | --- |
| ドメイン固有のAPI通信（クライアント側） | `app/domains/{domain}/_client/` |
| ページ固有のURL生成・変換など | `_utils.ts`（ページ側） |

## 型安全性とエラーハンドリング

### 採用設計：型ナローイング（Type Narrowing）

**採用理由:**

- TypeScript公式が推奨する型の絞り込みパターン(type narrowing)
- コンパイル時の型安全性を最大限活用
- 単一責任の原則に従う（呼び出し側が条件判定、関数は処理のみ）
- 例外を使わない通常のフロー制御

**実装例:**

```typescript
// 型ガード関数
const isOrderedTeamData = (team: TeamData | undefined): team is OrderedTeamData => {
  return !!team?.order && !!team?.updatedAt
}

// 呼び出し側で型ナローイング
if (isOrderedTeamData(team1) && isOrderedTeamData(team2)) {
  // ここでは team1, team2 は OrderedTeamData 型として扱われる
  const content = createCompletionMessage({ meta, teams: { team1, team2 } })
} else {
  const content = createPartialMessage({ meta, teams: { team1, team2 } })
}
```

**今のところ不採用とした設計パターン:**

1. **Result型パターン**: TypeScript標準ではなく、外部ライブラリ（neverthrow等）が必要。TypeScriptコミュニティでは一般的でない。
2. **例外ベース検証**: 関数内で `throw` してエラーを投げる方式。TypeScriptでは型ナローイングの方が推奨される。
3. **null返却パターン**: シンプルだが、型ガードに比べて型安全性が低い。

## テストコード

### テストタイトルの命名規則

全てのテストケースのタイトルには、以下のプレフィックスを必ず付ける：

- **`success:`** - 正常系テスト（期待通りの動作を確認）
- **`failure:`** - 異常系テスト（エラーケース、バリデーション失敗などを確認）

**実装例:**

```typescript
describe("Echo Command", () => {
  it("success: 正しいメッセージを返す", async () => {
    // 正常系のテスト
  })

  it("failure: 不正なリクエストで400を返す", async () => {
    // 異常系のテスト
  })
})
```

**メリット:**

- テストケースの意図が一目で分かる
- 正常系・異常系のバランスを把握しやすい
- レビュー時にテストカバレッジを確認しやすい
