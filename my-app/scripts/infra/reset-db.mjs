// DBを初期化する（破壊的）。テスト段階で中身を捨てて作り直す用途。
//
// public スキーマの全テーブルと、drizzle のマイグレーション追跡スキーマを drop する。
// 実行後に `npm run db:migrate` を走らせると 0000〜0003 がクリーンに再適用され、
// __drizzle_migrations と実スキーマが一致した状態になる。
//
// 使い方（対象を間違えないこと！ dev と prod で DATABASE_URL を必ず切り替える）:
//   cd my-app
//   # 接続先は my-app/.env の DATABASE_URL か、コマンド先頭の DATABASE_URL=... で指定（後者が優先）
//   CONFIRM_RESET=yes DATABASE_URL="<対象のdirect接続文字列>" node scripts/infra/reset-db.mjs
//   DATABASE_URL="<同上>" npm run db:migrate   # ← 初期化後にこれで 0000〜0003 を再適用
//   ※ .env の値を使う場合でも、誤爆防止のため対象ホストが表示されるので必ず確認すること
//
// --- Neon コンソールだけで完結させる場合（接続文字列を手元に出したくない時）---
// 1. 対象プロジェクトの Neon コンソール → SQL Editor で、接続先のブランチ/DBが
//    dev か prod か（main=Production / develop=Preview）を必ず確認する。
// 2. 以下を実行して初期化する:
//      DROP SCHEMA public CASCADE;
//      CREATE SCHEMA public;
//      DROP SCHEMA IF EXISTS drizzle CASCADE;
// 3. GitHub Actions の "DB Migrate (Neon)" を workflow_dispatch で再実行する
//    （実行ブランチに応じた environment の DATABASE_URL secret で migrate が走る）。
// 4. run が緑になれば __drizzle_migrations と実スキーマが一致した状態になる。

// my-app/.env を読み込む。環境変数で DATABASE_URL が渡っていればそちらが優先される。
import "dotenv/config"
import { Pool } from "pg"

const url = process.env.DATABASE_URL
if (!url) {
  console.error(
    "ERROR: DATABASE_URL を取得できませんでした。\n" +
      "  my-app/.env に DATABASE_URL を設定するか、コマンド先頭で DATABASE_URL=... を指定してください。",
  )
  process.exit(1)
}
if (process.env.CONFIRM_RESET !== "yes") {
  console.error(
    `ERROR: 破壊的操作です。実行するには CONFIRM_RESET=yes を付けてください。\n対象ホスト: ${new URL(url).hostname}`,
  )
  process.exit(1)
}

const pool = new Pool({ connectionString: url })
console.log(`対象ホスト: ${new URL(url).hostname} を初期化します...`)

// public を作り直し、drizzle 追跡スキーマも消す。
await pool.query("DROP SCHEMA public CASCADE")
await pool.query("CREATE SCHEMA public")
await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE")

await pool.end()
console.log("初期化完了。次に `npm run db:migrate` を実行してください。")
