// PostgreSQL への Drizzle クライアント
//
// 接続先によってドライバを自動で切り替える:
// - 本番(Neon): HTTPベースの @neondatabase/serverless（neon-http）。
//   Vercel のサーバーレスでコネクション枯渇を避けるため。
// - ローカル(Docker等): 通常の node-postgres(pg)。素の Postgres は Neon の
//   HTTPプロトコルを話せないため、こちらで TCP 接続する。
//
// 判定は DATABASE_URL のホストが neon.tech かどうか。
// ローカルは docker-compose.yml の Postgres を使う想定（本番DBを触らない）。

import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http"
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres"
import { neon } from "@neondatabase/serverless"
import { Pool } from "pg"
import { DATABASE_URL } from "../env"
import * as schema from "../../../_domains/teamSchedules/_server/schema"

export const isNeon = DATABASE_URL.includes("neon.tech")

// 接続先ホスト名（疎通チェックで「Neonに繋がっているか/localhostにフォールバックしてないか」を
// サーバーログから確認するために使う）。レスポンスには含めない。認証情報も含めない。
// パース不能・未設定時は空文字。
export const dbHost: string = (() => {
  try {
    return new URL(DATABASE_URL).hostname
  } catch {
    return ""
  }
})()

// neon-http と node-postgres でクエリAPIは共通。利用側は同じ db を使える。
// 型は片方（NeonHttpDatabase）に寄せる。2ドライバの union のままだと
// .returning() 等のオーバーロードが解決できず型エラーになるため。
export const db: NeonHttpDatabase<typeof schema> = isNeon
  ? drizzleNeon({ client: neon(DATABASE_URL), schema })
  : (drizzlePg({ client: new Pool({ connectionString: DATABASE_URL }), schema }) as unknown as NeonHttpDatabase<typeof schema>)

export { schema }
