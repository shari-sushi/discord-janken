# team_schedules: isDayKey が実在日付を検証しない不具合の修正

> 元 issue: [#90](https://github.com/shari-sushi/discord-janken/issues/90)（PR #88 レビューで検出）
> ⚠️ 本計画は暫定。仕様は 2026-06-17 に作者と確定する。

## 目的・背景

`isDayKey`（[validators.ts:40](../../my-app/app/_domains/teamSchedules/_server/validators.ts#L40)）は `YYYY-MM-DD` の**正規表現チェックのみ**で、実在しない日付（`2026-02-31`, `2026-99-99` 等）を弾けていない。

不在日付がバリデーションを通過すると PostgreSQL の `date` 型 INSERT で reject され、**本来 400 で返すべき入力エラーが 500（サーバーエラー）** になる。

実害は限定的（不正入力時のステータスコードが 500 になるだけ）だが、UX/一貫性のため残務として登録されたもの。

## 影響経路

- schedule の GET（from/to）・PUT・DELETE（day パラメータ）
- 同型の検証が `team-status` 系（[team-status/route.ts](../../my-app/app/api/web/team-schedules/teams/%5BteamId%5D/team-status/route.ts)）にも波及していないか要確認

## 実装方針（案）

`isDayKey` に実在日付チェックを追加する。

1. 正規表現で `YYYY-MM-DD` 形式を確認（現状維持）
2. 分解した year/month/day で `Date`（UTC）を生成し、各成分が一致するか検証
   - 例: `new Date(Date.UTC(y, m-1, d))` の `getUTCFullYear/Month/Date` が入力と一致すること（`2026-02-31` は `03-03` に正規化されるので不一致で弾ける）
3. 不在日付は `isDayKey` が `false` を返し、呼び出し側で 400 を返す

## テスト

- `validators.test.ts`（既存）に追記。`success:` / `failure:` プレフィックス。
- `success:` 通常日付・うるう年 `2024-02-29`
- `failure:` `2026-02-31` / `2026-13-01` / `2026-99-99` / `2026-02-29`（非うるう年）

## 確認事項（2026-06-17 に決定）

- [ ] 修正範囲は `isDayKey` の純粋な修正のみでよいか（呼び出し側の 400 返却は既に正しく動く想定）
- [ ] `team-status` 系など、`isDayKey` を使っていない別経路でも同じ検証漏れがないか棚卸しするか
- [ ] うるう年・タイムゾーンの扱い（カレンダー日付なので UTC 固定でよいか）
