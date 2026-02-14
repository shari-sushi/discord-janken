import { NextRequest, NextResponse } from "next/server"
import { validateAuthHeader } from "@/app/libs/auth"
import { validateDiscordId, validateIsProtect, validateIsRoleSelect, validateMembers } from "../_validators/discordValidators"
import { newId } from "@/app/util/newId"
import { sendDiscordMessage, DiscordApiError } from "@/app/libs/discordApi"
import { createProtectComponents } from "@/app/util/protectMessageComponents"
import { redisSet } from "@/app/libs/redis/redis"
import { MatchMembers, ProtectMatchMeta } from "@/app/types/match"
import { getMatchKey } from "@/app/util/redisKeys"

/**
 * POST /api/web/lol/matches
 * 試合を作成し、オプションでDiscordにプロテクト登録メッセージを送信
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 認証（Bearer Token または Basic認証）
    const authHeader = request.headers.get("Authorization")
    const authResult = await validateAuthHeader(authHeader)

    if (!authResult.valid) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 401 })
    }

    // 2. リクエストボディの取得
    let body: { guild_id: string; channel_id: string; isProtect?: boolean; isRoleSelect?: boolean; members?: MatchMembers }
    try {
      body = await request.json()
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return NextResponse.json({ success: false, error: "不正なJSONフォーマットです" }, { status: 400 })
    }

    const { guild_id, channel_id, isProtect, isRoleSelect, members } = body

    // 3. バリデーション
    const guildIdValidation = validateDiscordId(guild_id)
    if (!guildIdValidation.valid) {
      return NextResponse.json({ success: false, error: `guild_id: ${guildIdValidation.error}` }, { status: 400 })
    }

    const channelIdValidation = validateDiscordId(channel_id)
    if (!channelIdValidation.valid) {
      return NextResponse.json({ success: false, error: `channel_id: ${channelIdValidation.error}` }, { status: 400 })
    }

    const isProtectValidation = validateIsProtect(isProtect)
    if (!isProtectValidation.valid) {
      return NextResponse.json({ success: false, error: `isProtect: ${isProtectValidation.error}` }, { status: 400 })
    }

    const isRoleSelectValidation = validateIsRoleSelect(isRoleSelect)
    if (!isRoleSelectValidation.valid) {
      return NextResponse.json({ success: false, error: `isRoleSelect: ${isRoleSelectValidation.error}` }, { status: 400 })
    }

    // 4. 機能有効性チェック
    const isProtectFlag = isProtect === true
    const isRoleSelectFlag = isRoleSelect === true

    if (!isProtectFlag && !isRoleSelectFlag) {
      return NextResponse.json({ success: false, error: "isProtect または isRoleSelect の少なくとも一方を true にする必要があります" }, { status: 400 })
    }

    // 5. isRoleSelect と members の整合性チェック
    if (isRoleSelectFlag && !members) {
      return NextResponse.json({ success: false, error: "isRoleSelect: true で members なしの機能は未実装です" }, { status: 400 })
    }

    // 6. members のバリデーション（存在する場合のみ）
    if (members) {
      const membersValidation = validateMembers(members)
      if (!membersValidation.valid) {
        return NextResponse.json({ success: false, error: `members: ${membersValidation.error}` }, { status: 400 })
      }
    }

    // 7. 試合ID生成
    const matchId = newId()

    // 8. メタデータをRedisに保存
    const meta: ProtectMatchMeta = {
      match_id: matchId,
      created_at: new Date().toISOString(),
      isProtect: isProtectFlag,
      isRoleSelect: isRoleSelectFlag,
      ...(members && { members }),
    }
    await redisSet(getMatchKey(matchId, "meta"), meta)

    // 9. Discord API へのメッセージ送信
    try {
      const components = createProtectComponents(matchId)
      const response = await sendDiscordMessage(channel_id, "チームを選択してください", components)

      // 10. 成功レスポンス
      return NextResponse.json(
        {
          success: true,
          match_id: matchId,
          message_id: response.id,
        },
        { status: 200 },
      )
    } catch (error) {
      // Discord API エラーハンドリング
      if (error instanceof DiscordApiError) {
        let errorMessage = "Discordへのメッセージ送信に失敗しました"

        switch (error.status) {
          case 401:
            errorMessage = "Discord Bot認証エラー（トークンが無効です）"
            break
          case 403:
            errorMessage = "Discord Bot権限エラー（チャンネルへの送信権限がありません）"
            break
          case 404:
            errorMessage = "Discord チャンネルが見つかりません"
            break
          case 429:
            errorMessage = "Discord APIレート制限に達しました。しばらく待ってから再試行してください"
            break
        }

        return NextResponse.json({ success: false, error: errorMessage, details: error.details }, { status: error.status === 429 ? 429 : 500 })
      }

      // その他のエラー
      throw error
    }
  } catch (error) {
    console.error("POST /api/web/lol/matches error:", error)
    return NextResponse.json({ success: false, error: "サーバーエラーが発生しました" }, { status: 500 })
  }
}
