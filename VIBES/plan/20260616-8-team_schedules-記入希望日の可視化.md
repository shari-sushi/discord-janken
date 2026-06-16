# team_schedules: チームからメンバーへ記入して欲しい日が分かるようにする

> 元 issue: [#104](https://github.com/shari-sushi/discord-janken/issues/104)
> 関連: [#105](https://github.com/shari-sushi/discord-janken/issues/105)（Discord への可視化）
> ⚠️ 本計画は暫定。仕様は 2026-06-17 に作者と確定する。

## 目的・背景

チームがメンバーに対して「この期間・この日を記入してほしい」と示し、メンバーが**どの日を埋めるべきか一目で分かる**ようにする。現状はグリッドにどこを記入すべきかの指示が無い。

`#105`（Discord への可視化）と同じ「記入してほしい期間/日付」のデータを共有するため、データモデルは両者で共通化するのが望ましい。

## 実装方針（案）

### 1. データモデル

「チームが記入を期待する期間/日付」を保持する。候補:

- teams に `request_from` / `request_to`（期間）を持たせる軽量案
- 専用テーブル `team_fill_requests`（teamId, day or 期間, 作成者, createdAt）で複数期間に対応する案

### 2. API

- admin が記入希望期間を設定する PATCH/POST
- グリッド描画用 GET で記入希望情報も返す

### 3. フロント

- [ScheduleGrid.tsx](../../my-app/app/team_schedules/_components/ScheduleGrid.tsx) / [ScheduleCell.tsx](../../my-app/app/team_schedules/_components/ScheduleCell.tsx) で、記入希望日かつ自分が未記入のセルを強調表示（バッジ/枠線/色）

## 確認事項（2026-06-17 に決定）

- [ ] 「記入してほしい」の単位：期間（from〜to）か、個別日付の集合か
- [ ] データの持ち方：teams の列に持たせるか専用テーブルか（`#105` と共通化前提）
- [ ] UI 表現：未記入×希望日のセルをどう強調するか（色・バッジ・フィルタ）
- [ ] `#105`（Discord可視化）と同時に設計・実装するか
