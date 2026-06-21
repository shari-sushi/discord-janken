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
 * Discord ID を BAN に追加する（理由は任意）。既に存在する場合は理由を上書きしない（冪等）。
 * 追加された行を返す（既存なら既存行）。
 */
export async function addDiscordBan(discordUserId: string, reason: string | null): Promise<DiscordBan> {
  const inserted = await db.insert(discordBans).values({ discordUserId, reason }).onConflictDoNothing({ target: discordBans.discordUserId }).returning()
  if (inserted[0]) return inserted[0]
  // 既に BAN 済み（onConflictDoNothing で 0 行）。既存行を引いて返す。
  // neon-http はトランザクション非対応のため、INSERT と SELECT の極小区間で当該行が
  // 削除されると 0 行になり得る（admin 専用フローなので実質起こらないが）。その場合は例外にする。
  const existing = await db.select().from(discordBans).where(eq(discordBans.discordUserId, discordUserId)).limit(1)
  if (!existing[0]) throw new Error("BAN 行の取得に失敗しました")
  return existing[0]
}

/** Discord ID の BAN を解除する。削除できたら true（存在しなければ false） */
export async function removeDiscordBan(discordUserId: string): Promise<boolean> {
  const deleted = await db.delete(discordBans).where(eq(discordBans.discordUserId, discordUserId)).returning({ discordUserId: discordBans.discordUserId })
  return deleted.length > 0
}
