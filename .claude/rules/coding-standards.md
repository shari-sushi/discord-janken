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

## TypeScriptコード

### 基本方針

- **言語**: TypeScript
- **コメント**: 複雑なロジックには日本語コメントを追加
- **過度な抽象化を避ける**: シンプルで読みやすいコードを優先
- **エラーハンドリング**:
  - try-catch で適切にエラーを処理し、ユーザーにわかりやすいメッセージを返す
  - 認証認可ではリソースの存在を隠匿するために、必要に応じてクライアントには404を返す

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
- **コマンド名のプレフィックス**: `lol-` を使用 (例: `/lol-new-match`)

## ファイル構造の原則

### 1. 機能単位でのファイル分割

- **原則**: 1つの Discord コマンド機能 = 1ファイル
- **場所**: `app/api/discord/application-command/` 配下
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
