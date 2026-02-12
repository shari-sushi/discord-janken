import { NextRequest, NextResponse } from "next/server"
import { validateAuthHeader } from "@/app/libs/auth"
import { validateDiscordId, validateIsProtect } from "../_validators/discordValidators"
import { newId } from "@/app/util/newId"
import { sendDiscordMessage, DiscordApiError } from "@/app/libs/discordApi"
import { createProtectComponents } from "@/app/util/protectMessageComponents"

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
    let body: { guild_id: string; channel_id: string; isProtect: boolean }
    try {
      body = await request.json()
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return NextResponse.json({ success: false, error: "不正なJSONフォーマットです" }, { status: 400 })
    }

    const { guild_id, channel_id, isProtect } = body

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

    // 4. isProtect による条件分岐
    const isProtectFlag = isProtect === true
    if (!isProtectFlag) {
      // note: isProtect: false は将来拡張用。現在は何もせずエラーを返す
      return NextResponse.json({ success: false, error: "isProtect: false は現在サポートされていません（将来拡張用）" }, { status: 400 })
    }

    // 5. 試合ID生成
    const matchId = newId()

    // 6. Discord API へのメッセージ送信
    try {
      const components = createProtectComponents(matchId)
      const response = await sendDiscordMessage(channel_id, "チームを選択してください", components)

      // 7. 成功レスポンス
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
