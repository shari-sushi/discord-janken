# parseReminderAt リファクタリング検討

## 背景

`discordValidators.ts` に置かれている `parseReminderAt` について、以下の2点を検討中。

## 検討項目 1: parseTime と parseReminderAt の分離

### 現状

`parseReminderAt` に「パース」と「翌日変換（HH:MM が過去なら翌日）」が混在している。

### 提案

- `parseTime`（非公開）: 純粋なパースのみ。ISO 8601 / M分後 / HH:MM をDate に変換
- `parseReminderAt`（公開）: `parseTime` をラップし、HH:MM が過去なら翌日に変換

```typescript
const parseTime = (input: string): Date | null => {
  // ISO 8601, M分後, HH:MM → Date 変換（業務ロジックなし）
}

export const parseReminderAt = (input: string): Date | null => {
  const date = parseTime(input)
  if (!date) return null
  // HH:MM のみ過去なら翌日
  if (/^(\d{1,2}):(\d{2})$/.test(input) && date <= new Date()) {
    date.setUTCDate(date.getUTCDate() + 1)
  }
  return date
}
```

### 過去日時チェック（ISO 8601）について

- `route.ts` 側で `reminderDate <= new Date()` をチェックしてエラーを返す案もあったが、
  リクエスト処理中に「過去になってしまう」レースコンディションがあるため対応しない
- QStash は過去の `notBefore` を受け取った場合、即時実行する（実害なし）

## 検討項目 2: parseReminderAt の置き場

### 現状

`discordValidators.ts` にあるが、バリデーター（`ValidationResult` を返す）ではなく
パーサー（`Date | null` を返す）であるため、ファイル名と責務が一致していない。

### 選択肢

- `app/util/parseReminderAt.ts` として独立させる
- `discordValidators.ts` のままにする（現状維持）

## 検討項目 3: e のシャドウイング

`app/api/web/lol/matches/route.ts` の catch ブロック内で変数 `e` が二重定義されている。

```typescript
} catch (e) {
  console.error("Reminder registration failed:", e)
  await sendDiscordMessage(...).catch((e) => { // ← 外の e と衝突
    console.error("...", e)
  })
}
```

内側の `.catch` の引数を `notifyErr` 等に変更すれば解消。
