// マイグレーション追跡テーブルと実DBスキーマのズレを診断する（読み取り専用）。
// 使い方（どちらでもOK）:
//   cd my-app
//   # 1) my-app/.env の DATABASE_URL を使う
//   node scripts/diagnose-migrations.mjs
//   # 2) 接続先を明示する（.env より優先される）
//   DATABASE_URL="<dev もしくは prod の direct 接続文字列>" node scripts/diagnose-migrations.mjs
//
// drizzle-kit migrate がエラーを握り潰すため、ここでは __drizzle_migrations の
// 適用記録と、実際に存在するテーブル/カラム/制約を SELECT で読み出して突き合わせる。

// my-app/.env を読み込む（drizzle.config.ts と同じ挙動）。
// 既に環境変数で DATABASE_URL が渡っていればそちらが優先される（dotenv は上書きしない）。
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

const pool = new Pool({ connectionString: url })

const q = async (label, sql) => {
  try {
    const { rows } = await pool.query(sql)
    console.log(`\n=== ${label} ===`)
    console.dir(rows, { depth: null })
    return rows
  } catch (e) {
    console.log(`\n=== ${label} (エラー) ===`)
    console.log(`${e.code ?? ""} ${e.message}`)
    return null
  }
}

console.log(`接続先ホスト: ${new URL(url).hostname}`)

// 1. drizzle の適用記録（デフォルトは drizzle スキーマの __drizzle_migrations）
await q(
  "適用済みマイグレーション (drizzle.__drizzle_migrations)",
  `SELECT id, hash, to_timestamp(created_at/1000) AS applied_at
   FROM drizzle.__drizzle_migrations ORDER BY id`,
)

// 2. public スキーマの実テーブル一覧
await q(
  "実在テーブル (public)",
  `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
)

// 3. 各マイグレーションが触る代表オブジェクトの有無
await q(
  "teams.management_mode カラム (0001で追加)",
  `SELECT column_name, data_type, column_default
   FROM information_schema.columns
   WHERE table_name = 'teams' AND column_name = 'management_mode'`,
)
await q(
  "team_members.team_role の制約 (0002で付け替え)",
  `SELECT conname, pg_get_constraintdef(oid) AS def
   FROM pg_constraint
   WHERE conrelid = 'public.team_members'::regclass AND conname LIKE '%team_role%'`,
)
await q(
  "uq_team_members_one_master 部分ユニークIndex (0002で追加)",
  `SELECT indexname FROM pg_indexes
   WHERE tablename = 'team_members' AND indexname = 'uq_team_members_one_master'`,
)
await q(
  "team_members.invited_by カラム (0003で追加)",
  `SELECT column_name FROM information_schema.columns
   WHERE table_name = 'team_members' AND column_name = 'invited_by'`,
)

await pool.end()
console.log("\n診断完了（読み取りのみ・変更なし）")
