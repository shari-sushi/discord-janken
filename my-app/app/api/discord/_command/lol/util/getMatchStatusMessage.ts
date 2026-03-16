import { redisGet, redisMGet } from "@/app/_server/lib/redis/redis"
import { getMatchKey } from "@/app/domains/lol/_server/redisKeys"
import { createCompletionEmbedData } from "./createCompletionEmbedData"
import { ProtectMatchMeta, RegisteredTeamData } from "@/app/domains/lol/types"
import { APIEmbed } from "discord-api-types/v10"

/**
 * 試合データを取得してメッセージデータを返す
 * @param matchId - 試合ID
 * @returns メッセージデータ（content または embeds）、データが見つからない場合は null
 */
export const getMatchStatusMessage = async (matchId: string): Promise<{ content?: string; embeds?: APIEmbed[] } | undefined> => {
  // 1. メタデータ取得
  const meta = await redisGet<ProtectMatchMeta>(getMatchKey(matchId, "meta"))
  if (!meta) {
    return undefined
  }

  // 2. 両チームデータ一括取得（MGET使用）
  const teamKeys = [getMatchKey(matchId, "blue_team"), getMatchKey(matchId, "red_team")]
  const [blueTeamData, redTeamData] = await redisMGet<RegisteredTeamData>(teamKeys)

  const teamsData = {
    blue: blueTeamData!,
    red: redTeamData!,
  }

  // 4. メッセージデータを構築して返す
  const status = registeredStatus({ redTeamData, blueTeamData, meta })
  switch (status) {
    case "bothDidNot":
      return { content: "🟦 ブルーサイド：✍️未登録\n🟥 レッドサイド：✍️未登録" }
    case "OnlyBlueDid":
      return { content: "🟦 ブルーサイド：✅登録済み\n🟥 レッドサイド：✍️未登録" }
    case "OnlyRedDid":
      return { content: "🟥 レッドサイド：✅登録済み\n🟦 ブルーサイド：✍️未登録" }
    case "bothDid":
      return createCompletionEmbedData(meta, teamsData)
    default:
      return undefined
  }
}

type isBothRegisteredArgs = { meta: ProtectMatchMeta; redTeamData: RegisteredTeamData | null; blueTeamData: RegisteredTeamData | null }
export type RegisteredStatus = "bothDid" | "bothDidNot" | "OnlyRedDid" | "OnlyBlueDid"

// test用にexportしてるだけ。本番コードで使うなら置き場を検討する。
export const registeredStatus = ({ meta, blueTeamData, redTeamData }: isBothRegisteredArgs): RegisteredStatus => {
  const blueRegistered = isTeamRegistered(blueTeamData, meta)
  const redRegistered = isTeamRegistered(redTeamData, meta)

  if (blueRegistered && redRegistered) return "bothDid"
  if (!blueRegistered && !redRegistered) return "bothDidNot"
  if (blueRegistered) return "OnlyBlueDid"
  return "OnlyRedDid"
}

const isTeamRegistered = (team: RegisteredTeamData | null, meta: ProtectMatchMeta): boolean => {
  if (!team) return false

  const protectDone = !meta.rules.isProtect || team.protection_champions !== ""
  const roleDone = !meta.rules.isRoleSelect || team.roster != null

  return protectDone && roleDone
}
