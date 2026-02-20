# リファクタリング実行計画：Discord Interaction ハンドラーの再構成

## 📋 背景と目的

### 現状の課題

- `route.ts` が約270行と肥大化し、可読性が低下
- 1つの機能に関連する処理が複数箇所に散在している
  - 例：`newProtect` 機能
    - コマンド処理: `newProtect.ts`
    - モーダル表示: `route.ts` 77-123行目
    - チーム登録: `route.ts` 249-265行目
    - 登録確認: `route.ts` 164-184行目
- 機能の全体像を把握するために複数ファイルを行き来する必要がある

### リファクタリングの目的

1. **機能単位でのコードの集約**：1つの機能の処理を1ファイルで完結させる
2. **可読性の向上**：関連コードが近接し、機能の流れが追いやすくなる
3. **保守性の向上**：機能追加・修正時に影響範囲が明確になる
4. **責務の明確化**：`route.ts` はルーティングのみに専念

---

## 🎯 リファクタリング方針

### 採用する設計パターン

**機能別完全分離パターン（案1）**

各機能の全ライフサイクル処理を対応する `application-command/` 配下のファイルに集約します。

### ファイル構造（リファクタリング後）

```txt
my-app/app/api/discord/
├── route.ts                           # ルーティング専用（署名検証 + 振り分けのみ）
├── application-command/
│   ├── echo.ts                        # echo機能（変更なし）
│   ├── newProtect.ts                  # newProtect機能の全処理 ★変更
│   └── feedback.ts                    # feedback機能の全処理 ★変更
└── types.ts                           # 型定義
```

---

## 📦 詳細な変更内容

### 1. `newProtect.ts` の変更

#### 移動する処理

| 処理内容 | 移動元 | 関数名（新規作成） |
|---------|--------|------------------|
| コマンド処理 | 既存 | `newProtectCommand()` |
| レッドチーム モーダル表示 | `route.ts` 77-99行目 | `handleOpenModalRedTeam(matchId: string)` |
| ブルーチーム モーダル表示 | `route.ts` 101-123行目 | `handleOpenModalBlueTeam(matchId: string)` |
| レッドチーム 登録処理 | `route.ts` 249-256行目 | `handleRegisterRedTeam(matchId: string, teamText: string)` |
| ブルーチーム 登録処理 | `route.ts` 258-265行目 | `handleRegisterBlueTeam(matchId: string, teamText: string)` |
| 登録状況確認 | `route.ts` 164-184行目 | `handleCheckRegistered(matchId: string)` |
| チームデータ保存 | `route.ts` 13-21行目 | `saveTeamAndCheckOther(...)` ※移動 |

#### export する関数
```typescript
export { newProtectCommand }           // 既存
export { handleOpenModalRedTeam }      // 新規
export { handleOpenModalBlueTeam }     // 新規
export { handleRegisterRedTeam }       // 新規
export { handleRegisterBlueTeam }      // 新規
export { handleCheckRegistered }       // 新規
```

---

### 2. `feedback.ts` の変更

#### 移動する処理

| 処理内容 | 移動元 | 関数名（新規作成） |
|---------|--------|------------------|
| コマンド処理 | 既存 | `feedbackCommand()` |
| フィードバック種類選択 | `route.ts` 125-162行目 | `handleSelectFeedbackType(selectedType: string)` |
| フィードバック送信 | `route.ts` 202-243行目 | `handleSubmitFeedback(interaction)` |

#### export する関数
```typescript
export { feedbackCommand }             // 既存
export { handleSelectFeedbackType }    // 新規
export { handleSubmitFeedback }        // 新規
```

---

### 3. `route.ts` の変更

#### リファクタリング後の責務
1. **署名検証**：Discord からのリクエストの妥当性確認
2. **ルーティング**：インタラクションタイプと custom_id に基づいて適切なハンドラーに振り分け

#### 削除する処理
- チームデータ保存関数（13-21行目）→ `newProtect.ts` へ移動
- 全てのビジネスロジック

#### 最終的な行数目安

約100-120行（現在の270行から半減以下）

---

## 📐 コーディング規約への追加事項

### ファイル構造の原則

#### 1. 機能単位でのファイル分割

- **原則**：1つの Discord コマンド機能 = 1ファイル
- **場所**：`app/api/discord/application-command/` 配下
- **命名**：コマンド名と同じ（例：`/lol-new-protect` → `newProtect.ts`）

#### 2. 1ファイル内に含める処理

各コマンド機能ファイルには、以下の全処理を含める：

```
✅ コマンド初期表示（APPLICATION_COMMAND）
✅ ボタン/選択メニュー処理（MESSAGE_COMPONENT）
✅ モーダル送信処理（MODAL_SUBMIT）
✅ その機能専用のヘルパー関数
```

#### 3. export の方針

- **コマンド関数**：必ず export（`route.ts` から呼ばれる）
- **ハンドラー関数**：必ず export（`route.ts` から呼ばれる）
- **内部ヘルパー関数**：export しない（ファイル内でのみ使用）

#### 4. `route.ts` の責務

```typescript
// ✅ route.ts が行うこと
- Discord署名検証
- インタラクションタイプの判定
- 適切なハンドラー関数の呼び出し

// ❌ route.ts が行わないこと
- ビジネスロジック
- Discord レスポンスの組み立て
- データベース操作
```

---

## 🔧 実装手順

### Phase 1: newProtect 機能の集約

1. `newProtect.ts` にヘルパー関数を追加
   - `saveTeamAndCheckOther()` を移動
2. `newProtect.ts` に各ハンドラー関数を追加
   - `handleOpenModalRedTeam()`
   - `handleOpenModalBlueTeam()`
   - `handleRegisterRedTeam()`
   - `handleRegisterBlueTeam()`
   - `handleCheckRegistered()`
3. `route.ts` から該当処理を削除し、ハンドラー呼び出しに置き換え

### Phase 2: feedback 機能の集約

1. `feedback.ts` に各ハンドラー関数を追加
   - `handleSelectFeedbackType()`
   - `handleSubmitFeedback()`
2. `route.ts` から該当処理を削除し、ハンドラー呼び出しに置き換え

### Phase 3: route.ts の簡素化

1. 削除された処理を確認
2. import文を整理
3. コードフォーマット

### Phase 4: 動作確認

1. ビルド確認
2. 各コマンドの動作テスト
   - `/lol-new-protect`
   - `/lol-feedback`
   - `/lol-echo`

---

## ✅ 完了チェックリスト

### コード品質

- [ ] `route.ts` が120行以下になっている
- [ ] 各機能ファイルで関連処理が全て完結している
- [ ] ヘルパー関数が適切なファイルに配置されている
- [ ] export/import が適切に設定されている
- [ ] 型エラーがない

### 機能確認

- [ ] `/lol-new-protect` が正常動作する
  - [ ] レッドチーム登録モーダルが開く
  - [ ] ブルーチーム登録モーダルが開く
  - [ ] 片方登録時に「登録完了」メッセージが表示される
  - [ ] 両方登録時に両チームの内容が表示される
  - [ ] 確認ボタンで登録状況が表示される
- [ ] `/lol-feedback` が正常動作する
  - [ ] フィードバック種類選択メニューが表示される
  - [ ] モーダルが開く
  - [ ] Google Sheets に保存される
- [ ] `/lol-echo` が正常動作する

### ドキュメント

- [ ] CLAUDE.md にコーディング規約を追記
- [ ] このドキュメントを最終更新

---

## 📝 備考

### 依存関係の注意点

- `saveTeamAndCheckOther()` は Redis を使用するため、import文に `@/app/libs/redis/redis` が必要
- `handleSubmitFeedback()` は Google Sheets を使用するため、import文に `@/app/libs/googleSheets` が必要

### 今後の拡張性

この構造により、新しいコマンドを追加する際は：

1. `application-command/` 配下に新ファイルを作成
2. コマンド + 全ハンドラーを実装
3. `route.ts` に振り分けロジックを追加

の3ステップで完結し、既存コードへの影響を最小化できます。

---

**作成日**: 2026-02-08
**対象バージョン**: discord-janken v1.0
