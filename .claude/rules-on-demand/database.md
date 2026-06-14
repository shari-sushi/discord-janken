# データベース（PostgreSQL + Drizzle）

スクリム調整機能（`/team_schedules`）で使う PostgreSQL のルール。
**ローカルは Docker、本番は Neon** に分離している。

## 構成

| 項目 | 場所 |
| --- | --- |
| スキーマ定義 | `my-app/app/_domains/teamSchedules/_server/schema.ts` |
| DBクライアント | `my-app/app/_server/lib/db/index.ts` |
| Drizzle設定 | `my-app/drizzle.config.ts` |
| マイグレーションSQL | `my-app/drizzle/` |
| ローカルDB定義 | ルートの `docker-compose.yml` の `db` サービス |

## ドライバ自動切替

`db/index.ts` は `DATABASE_URL` のホストを見てドライバを自動で選ぶ：

- ホストが `neon.tech` → `neon-http`（HTTP接続。Vercelのコネクション枯渇対策）
- それ以外（`localhost` 等） → `node-postgres`(`pg`)（素のPostgresへTCP接続）

そのため `.env` の `DATABASE_URL` を差し替えるだけで接続先が切り替わる。

- 注意: `pg` と `@types/pg` は **`my-app/` 配下**にインストールすること（リポジトリのルートではない）。`db/index.ts` が `pg` を import しているため、未インストールだとローカル開発のDB接続が壊れる。

## ローカル開発フロー

```bash
# DB + Redis 起動（ルートで実行）
docker compose up -d db redis

# アプリはホストで起動（.env の localhost:5432 を読む）
cd my-app && npm run dev
```

`.env` のローカル用 `DATABASE_URL`:

```txt
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/team_schedules
```

## マイグレーション

```bash
cd my-app
npm run db:generate   # schema.ts の変更から SQL を生成（drizzle/ に出力）
npm run db:migrate    # 接続先DBに適用
npm run db:studio     # GUIで中身を確認
npm run db:push       # 開発時に生成をスキップして直接スキーマを反映（任意）
```

- `drizzle-kit` は `dotenv/config` で **`.env`** を読む（`.env.local` ではない）。
- CHECK制約は Drizzle のバージョンによって生成SQLに出ないことがある。`db:generate` 後、
  出力された SQL に `CONSTRAINT ... CHECK` が入っているか目視確認する。

### 本番 Neon にマイグレーションする時

`.env` をローカルに保ったまま、その場だけ環境変数を上書きする：

```bash
cd my-app
DATABASE_URL="postgresql://<neonの接続文字列>" npm run db:migrate
```

## 状態確認（テーブル・制約・マイグレーション件数）

### ローカル（Docker）

```bash
docker exec discord-janken-db psql -U postgres -d team_schedules -c "\dt"
```

### 本番 Neon（または任意の接続先）

`my-app/` で一時スクリプトを作って確認する（`@neondatabase/serverless` が入っているため）：

```bash
cd my-app
cat > verify_db.mjs <<'EOF'
import { neon } from "@neondatabase/serverless"
const sql = neon(process.env.DATABASE_URL)
const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
console.log("テーブル:", tables.map((t) => t.table_name).join(", "))
const checks = await sql`SELECT conname FROM pg_constraint WHERE contype='c' AND connamespace='public'::regnamespace ORDER BY conname`
console.log("CHECK制約:", checks.map((c) => c.conname).join(", "))
const mig = await sql`SELECT COUNT(*)::int AS n FROM drizzle.__drizzle_migrations`
console.log("適用済みマイグレーション数:", mig[0].n)
EOF
DATABASE_URL="postgresql://<確認したい接続文字列>" node verify_db.mjs
rm verify_db.mjs
```

期待される出力（init マイグレーション適用後）:

```txt
テーブル: discord_links, schedules, team_members, teams, users
CHECK制約: schedules_status_chk, team_members_team_role_chk, teams_required_count_chk
適用済みマイグレーション数: 1
```

## 環境変数

- ローカル: `.env` に Docker 用の `DATABASE_URL`
- 本番: Vercel の環境変数に Neon の `DATABASE_URL`（pooled 接続文字列を推奨）
- `.env` は `.gitignore` 済み。**接続文字列（パスワード）をコミットしないこと。**
