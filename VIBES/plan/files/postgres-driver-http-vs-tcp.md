# Postgres ドライバ: HTTPベース vs TCPベース

team_schedules 機能で Postgres に接続する際のドライバ選定の解説。
このプロジェクトは **本番(Neon)=HTTPベース / ローカル(docker)=TCPベース** を自動切替する構成を採用している（[db/index.ts](../../../my-app/app/_server/lib/db/index.ts)）。

## 結論（このプロジェクトの構成）

| 環境 | 接続先 | ドライバ | Drizzle アダプタ | 通信 |
| --- | --- | --- | --- | --- |
| 本番 (Vercel) | Neon | `@neondatabase/serverless` | `drizzle-orm/neon-http` | HTTPS |
| ローカル開発 | docker の素のPostgres | `pg` (node-postgres) | `drizzle-orm/node-postgres` | TCP |

`DATABASE_URL` に `neon.tech` が含まれるかで切り替える。Drizzle のクエリAPIは両アダプタで共通なので、**アプリ側のコードは接続先を意識せず同じ `db` を使える**。

## 前提: そもそも何が違うのか

Postgres と通信するには、本来 **TCP ソケット上で Postgres のワイヤープロトコル**を喋る。これが昔ながらの方式（TCPベース）。
これに対し Neon は **「SQLをHTTPSのリクエストで投げると結果が返ってくる」エンドポイント**を提供している。これを使うのがHTTPベース。

```txt
TCPベース :  アプリ ──(TCP接続を張りっぱなし)── Postgres
              └ 1本のコネクション上で何回もクエリを流す（状態を持つ）

HTTPベース:  アプリ ──(クエリごとに1回のHTTPS)── Neonのエンドポイント
              └ 1クエリ = 1リクエスト。接続を抱えない（状態を持たない）
```

## TCPベース (`pg` / node-postgres)

長寿命の TCP コネクションを張り、その上で何度もクエリを流す。Node.js での定番ドライバ。

**特徴:**

- コネクションは**状態を持つ（stateful）**。同じ接続が続くので、トランザクション(`BEGIN`〜`COMMIT`)・プリペアドステートメント・セッション設定が自然に効く。
- 接続の開閉はコストが高いので、**コネクションプール**で使い回す。
- **どの Postgres にも繋がる**（ローカルdocker、RDS、Neonのプーラ経由など）。

**サーバーレスでの弱点（コネクション枯渇）:**

- Vercel はリクエストごとに関数インスタンスが大量に並列起動する。各インスタンスが接続を抱えると、**Postgres の同時接続上限を食いつぶして `too many connections` で落ちる**。
- 回避するには PgBouncer 等の外部プーラ（Neon の pooled エンドポイント）を前段に挟む必要がある。

**このプロジェクトでの用途:** ローカルの docker Postgres は素の Postgres で Neon の HTTP を喋れないため、ローカル開発はこの `pg` で TCP 接続する。ローカルは並列起動しないので枯渇問題は起きない。

## HTTPベース (`@neondatabase/serverless` / neon-http)

クエリを1回のHTTPS（fetch）で投げ、レスポンスで結果を受け取る。Neon 専用。

**特徴:**

- **状態を持たない（stateless）**。接続を抱え込まないので、関数が何個並列起動しても**コネクション枯渇が原理的に起きない**。
- コールドスタートに強く、TCPソケットが使えない**エッジランタイム**（Cloudflare Workers 等）でも動く。
- Vercel のサーバーレスと相性が良い（handoff 8章の推奨理由）。

**制約:**

- **Neon にしか繋がらない**（Neon の HTTP エンドポイント専用）。ローカルの素の Postgres には接続できない → だからローカルは `pg` に切り替える必要がある。
- 1クエリ=1リクエストなので、**アプリのロジックを挟む対話的なトランザクション**（`BEGIN` → 計算 → `COMMIT` を別々の await でまたぐ）はできない。複数文をまとめる場合は Drizzle の `db.transaction()`（1リクエストにバッチ送信）を使う。
  - セッションをまたぐ本格的なトランザクションが必要なら、同パッケージの **WebSocket版（`neon-serverless`）** を使えば pg 同様に stateful にできる。team_schedules の用途（セル単位の upsert/delete）では neon-http で十分。

## なぜ「自動切替」なのか

- **本番**: Vercel サーバーレス × Neon。枯渇回避のため HTTP ベースが最適。
- **ローカル**: docker の素の Postgres。Neon の HTTP を喋れないので TCP（`pg`）一択。
- Drizzle の `neon-http` と `node-postgres` は**クエリAPIが同一**なので、接続生成だけ分岐すればアプリコードは共通化できる。

```ts
const isNeon = DATABASE_URL.includes("neon.tech")
export const db = isNeon
  ? drizzleNeon({ client: neon(DATABASE_URL), schema })   // 本番: HTTP
  : drizzlePg({ client: new Pool({ connectionString: DATABASE_URL }), schema }) // ローカル: TCP
```

## 運用メモ

- ローカル開発では `pg` / `@types/pg` が必要（db/index.ts が import している）。
- ローカルの `DATABASE_URL` 例:
  `postgresql://postgres:postgres@localhost:5432/team_schedules`（[docker-compose.yml](../../../docker-compose.yml) の設定）
- 本番の Neon は pooled でない直結URLでも HTTP ドライバなら枯渇しないが、URL に `neon.tech` が含まれることが切替条件なので、設定時に確認する。
- マイグレーション（`drizzle-kit`）は接続先の `DATABASE_URL` をそのまま使う。ローカル検証は docker、 本番適用は Neon に対して実行する。
