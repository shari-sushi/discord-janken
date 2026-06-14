import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db, dbHost, isNeon } from "@/app/_server/lib/db"

// DB疎通チェック（認証不要）
// select 1 を投げて成否だけを返す。
// driver（neon-http/pg）・host・レイテンシといった内部情報はレスポンスに含めず、
// サーバーログにのみ出力する（Vercel のログで原因を追える）。
export async function GET() {
  const startedAt = Date.now()
  const driver = isNeon ? "neon-http" : "pg"

  try {
    await db.execute(sql`select 1`)
    const latencyMs = Date.now() - startedAt
    console.log(`db health: ok driver=${driver} host=${dbHost} latency=${latencyMs}ms`)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error"
    console.error(`db health: error driver=${driver} host=${dbHost}: ${message}`)
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
