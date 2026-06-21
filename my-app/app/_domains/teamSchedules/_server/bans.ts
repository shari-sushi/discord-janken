/**
 * スクリム調整機能 - Discord ID の BAN（ブラックリスト）操作（#166）
 *
 * magic-link でのセルフサインアップ/ログインを遮断するための仕組み。
 * 判定は auth/verify（新規ログイン時）でのみ行う。
 *
 * ↓注意: 既に ts_session（最大30日）を持つユーザーは、後から BAN されても
 *        利用者ページ側の API では弾かれず素通りする（即時失効は将来対応）。
 *        利用者側 API で BAN 強制を入れる場合は isDiscordBanned をその起点として使う。
 */

import { desc, eq } from "drizzle-orm"
import { db } from "@/app/_server/lib/db"
import { discordBans, type DiscordBan } from "./schema"

/** この Discord ID が BAN されているか */
export async function isDiscordBanned(discordUserId: string): Promise<boolean> {
  const rows = await db.select({ discordUserId: discordBans.discordUserId }).from(discordBans).where(eq(discordBans.discordUserId, discordUserId)).limit(1)
  return rows.length > 0
}

/** BAN 済み Discord ID の一覧（新しい順） */
export async function listDiscordBans(): Promise<DiscordBan[]> {
  return db.select().from(discordBans).orderBy(desc(discordBans.bannedAt))
}

/**
 * Discord ID を BAN に追加する（理由は任意）。
 * 既に BAN 済みの ID を再 BAN した場合は理由と BAN 日時を上書きする（upsert）。
 * 「理由を直したくて再登録したのに旧理由のまま」を防ぐため、冪等な no-op ではなく更新する。
 * 追加/更新後の行を返す（onConflictDoUpdate は競合時も必ず1行返すため、追加 SELECT は不要）。
 */
export async function addDiscordBan(discordUserId: string, reason: string | null): Promise<DiscordBan> {
  const rows = await db
    .insert(discordBans)
    .values({ discordUserId, reason })
    .onConflictDoUpdate({ target: discordBans.discordUserId, set: { reason, bannedAt: new Date() } })
    .returning()
  if (!rows[0]) throw new Error("BAN 行の取得に失敗しました")
  return rows[0]
}

/** Discord ID の BAN を解除する。削除できたら true（存在しなければ false） */
export async function removeDiscordBan(discordUserId: string): Promise<boolean> {
  const deleted = await db.delete(discordBans).where(eq(discordBans.discordUserId, discordUserId)).returning({ discordUserId: discordBans.discordUserId })
  return deleted.length > 0
}
