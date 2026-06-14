import "dotenv/config"
import { defineConfig } from "drizzle-kit"

// マイグレーション生成・適用の設定。
// スキーマは app/_domains/teamSchedules/_server/schema.ts に定義。
// マイグレーションSQLは drizzle/ 配下に出力する。
export default defineConfig({
  dialect: "postgresql",
  schema: "./app/_domains/teamSchedules/_server/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // text + CHECK 設計のため厳格に差分を出す
  strict: true,
  verbose: true,
})
