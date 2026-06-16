# team_schedules: チームメンバー管理（除名・ロール変更・移動）

> 元 issue: [#97](https://github.com/shari-sushi/discord-janken/issues/97)
> 前提: [#98](https://github.com/shari-sushi/discord-janken/issues/98)（team_role を master/admin/member 化）は実装済み。
> ⚠️ 本計画は暫定。仕様は 2026-06-17 に作者と確定する。

## 目的・背景

> 管理者がチームメンバーを除名したり、自分の管理チーム内を移動させたり

`#98` で `team_role`（master / admin / member）と認可ヘルパー（[authz.ts](../../my-app/app/_domains/teamSchedules/_server/authz.ts) の `assertTeamAdmin` / `assertTeamMaster` / `hasAdminAuthority`）は整備済み。これを使ってメンバー管理操作を実装する。

## 権限ルール（issue #98 の定義）

- **master**: 必ず1人。admin/member とチーム・自分を管理でき、master 権限を他人に譲渡できる
- **admin**: member とチーム・自分を編集できる
- **member**: 自分のことだけ編集できる

DB 側は `uq_team_members_one_master`（部分ユニークインデックス）で master 高々1人を担保済み。

## 実装方針（案）

### API（いずれも `app/api/web/team-schedules/teams/[teamId]/members/...`）

| メソッド | パス | 認可 | 内容 |
| --- | --- | --- | --- |
| GET | `/members` | メンバー（#99 と整合） | メンバー一覧+ロール |
| PATCH | `/members/[userId]` | admin 以上 | team_role 変更・can-play(top..support) 変更 |
| DELETE | `/members/[userId]` | admin 以上 | 除名 |
| POST | `/members/[userId]/transfer-master` | master のみ | master 譲渡（旧 master は admin/member へ降格） |

### 不変条件（要注意）

- **master を 0 人にしない**: master の除名・降格・自己離脱は禁止（先に譲渡が必要）
- master 譲渡はトランザクションで「新 master 昇格 + 旧 master 降格」を原子的に行う（部分ユニーク制約違反を避ける順序に注意）
- admin は master を操作できない（admin は member のみ管理）
- 自分自身の降格・離脱の扱いを定義する

### フロント

- チーム設定/メンバー一覧画面（`#96`・`#108` と同居）でロール変更・除名・譲渡

## テスト

- `success:` admin が member を除名 / master が譲渡
- `failure:` admin が master を操作不可 / member が他人を操作不可 / 最後の master を降格・除名不可

## 確認事項（2026-06-17 に決定）

- [ ] 「自分の管理チーム内を移動させる」の意味（複数チーム間でメンバーを移すのか、チーム内ロール変更のことか）
- [ ] master 譲渡時、旧 master は admin に降格か member か
- [ ] member 自身がチームを「脱退」できるか（self-leave の有無）
- [ ] admin が自分を admin→member に降格できるか
- [ ] メンバー追加（招待経由）は `#108` の招待リンク管理と統合するか
