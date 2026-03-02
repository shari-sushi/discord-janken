import { extractMatchId as _extractMatchId } from "@/app/api/discord/util/extractCustomIdParam"

/**
 * 失敗時にthrowするようWrapした extractMatchId
 * @throws {Error} match_idが抽出できない場合
 */
export const extractMatchId = (customId: string): string => {
  const matchId = _extractMatchId(customId)

  if (!matchId) {
    throw new Error(`テスト失敗: matchId が抽出できませんでした: ${customId}`)
  }

  return matchId
}
