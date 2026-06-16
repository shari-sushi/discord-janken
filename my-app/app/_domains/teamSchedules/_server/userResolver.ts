/**
 * スクリム調整機能 - Discord ID からアプリユーザーを解決/作成する
 *
 * magic-link 検証（auth/verify）と Discord 招待コマンドの双方から呼ぶ共通処理。
 * discord_links を引いて既存ユーザーを返し、無ければ users + discord_links を作成する
 * （セルフサインアップ。display_name = Discordユーザー名）。
 */

import { eq } from "drizzle-orm"
import { db } from "@/app/_server/lib/db"
import { discordLinks, users } from "./schema"

/**
 * discordUserId に紐づくアプリユーザーを返す。無ければ作成する。
 *
 * 既知のリスク: neon-http はトランザクション非対応のため users / discord_links を逐次 INSERT。
 * users INSERT 成功後に discord_links INSERT が失敗すると、次回ログインでリンクが見つからず
 * 別 user が再作成され重複する。重要度は高いがエッジ。恒久対応は別 Issue で検討（teams POST と同件）。
 */
export async function resolveOrCreateUserByDiscordId(discordUserId: string, username: string): Promise<{ userId: string; displayName: string }> {
  // discord_links と users を join して1クエリで解決（cold start 時の往復削減）。
  // discord_links.userId は users への FK（onDelete: cascade）なので orphan link は発生せず、
  // ヒットすれば必ず users 行も存在する。
  const existing = await db
    .select({ userId: discordLinks.userId, displayName: users.displayName })
    .from(discordLinks)
    .innerJoin(users, eq(users.userId, discordLinks.userId))
    .where(eq(discordLinks.discordUserId, discordUserId))
    .limit(1)

  if (existing[0]) {
    return { userId: existing[0].userId, displayName: existing[0].displayName }
  }

  // passwordless（Discord magic-link）。password_hash は schema 上 notNull のため空文字で埋める
  // （認証方式が確定済みなので、将来別マイグレーションで列ごと削除予定）
  const inserted = await db.insert(users).values({ displayName: username, passwordHash: "" }).returning({ userId: users.userId, displayName: users.displayName })
  const userId = inserted[0].userId
  await db.insert(discordLinks).values({ discordUserId, userId })
  return { userId, displayName: inserted[0].displayName }
}
