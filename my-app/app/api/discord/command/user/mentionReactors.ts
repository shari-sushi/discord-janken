import { NextResponse, after } from "next/server"
import { getDiscordMessage, getAllReactionFields, editWebhookOriginalMessage, createFollowupMessage, DiscordApiError } from "@/app/_server/lib/discord/api"
import { createReactionEmbed } from "@/app/_domains/user/mentionByReaction/util/createReactionEmbed"
import { parseMessageLink } from "@/app/_domains/user/mentionByReaction/util/parseMessageLink"
import { MAX_REACTION_USERS } from "@/app/_domains/user/mentionByReaction/_server/constants"
import { APIChatInputApplicationCommandInteraction, InteractionResponseType, MessageFlags } from "discord-api-types/v10"

// 入力エラーは defer せず即時 ephemeral で返すためのヘルパー（「考え中」表示を出さない）
const ephemeralError = (content: string): NextResponse =>
  NextResponse.json({
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content,
      flags: MessageFlags.Ephemeral,
    },
  })

// コマンド初期表示
export const mentionReactorsCommand = (interaction: APIChatInputApplicationCommandInteraction): NextResponse => {
  // オプションからメッセージリンクを取得
  const options = interaction.data?.options as Array<{ name: string; value: string }> | undefined
  const messageLink = options?.find((opt) => opt.name === "message_link")?.value

  // 入力バリデーションは defer 前に同期 ephemeral で即返す（軽い入力エラーに「考え中」表示は過剰）
  if (!messageLink) {
    return ephemeralError("メッセージリンクが指定されていません")
  }

  const parsed = parseMessageLink(messageLink)
  if (!parsed) {
    return ephemeralError("不正なメッセージリンクです。Discord のメッセージを右クリックして「メッセージのリンクをコピー」で取得してください。")
  }

  // コマンド実行者の情報を取得（embed の footer 用。defer 後は interaction が使えないのでここで確定）
  const executor = interaction.member?.nick || interaction.member?.user?.username || interaction.user?.username || "不明"
  const { token, application_id } = interaction

  // 重い処理（メッセージ取得 → リアクション逐次集計 → embed 生成）は 3 秒制限を避けるため after() 内で実施する。
  // 可視性パリティ: defer は ephemeral（下記）なので、成功時だけ embed を public followup で投稿し、
  // エラー／リアクションなしは ephemeral な original を編集して実行者にのみ伝える（旧同期実装と同じ可視性）。
  after(async () => {
    try {
      const message = await getDiscordMessage(parsed.channelId, parsed.messageId)

      // リアクションがない場合（ephemeral な original を編集＝実行者にのみ表示）
      if (!message.reactions || message.reactions.length === 0) {
        await editWebhookOriginalMessage(application_id, token, "指定されたメッセージにはリアクションがありません")
        return
      }

      // リアクションごとにユーザーリストを逐次取得（並列だと rate limit に引っかかるため）。
      // 取得は MAX_REACTION_USERS で打ち切り（超過分は下流が「…ほか N 人」として明示する）。
      const reactionFields = await getAllReactionFields(parsed.channelId, parsed.messageId, message.reactions, { maxUsers: MAX_REACTION_USERS })

      // Embed メッセージを作成
      const embed = createReactionEmbed({
        messageContent: message.content,
        reactionFields,
        executor,
      })

      // 成功時のみ embed を public followup で投稿する（旧実装の「成功 embed のみ public」を踏襲）。
      // 結果は embed に閉じ込める（content にユーザー由来文字列を流さない）。
      // メンション（<@id>）は embed 内なので実際にはピングしないが、public 投稿なので allowed_mentions も全抑止する。
      await createFollowupMessage(application_id, token, "", undefined, false, { parse: [] }, [embed])

      // ephemeral な original は完了通知に差し替えて締める（実行者にのみ表示）
      await editWebhookOriginalMessage(application_id, token, "リアクションメンバーを投稿しました。")
    } catch (e) {
      console.error("mentionReactorsCommand after error:", e instanceof DiscordApiError ? JSON.stringify(e.details) : e)
      let errorMessage = "メッセージまたはリアクション情報の取得に失敗しました。Bot に該当チャンネルへのアクセス権限があるか確認してください。"
      if (e instanceof DiscordApiError && e.status === 429) {
        errorMessage = "⚠️ Discord APIのレートリミットに達したため、リアクション情報を取得できませんでした。\n時間をおいてから再度お試しください。"
      }
      try {
        // エラーは ephemeral な original を編集＝実行者にのみ表示（公開チャンネルに失敗文言を出さない）
        await editWebhookOriginalMessage(application_id, token, errorMessage)
      } catch (editError) {
        console.error("mentionReactorsCommand error message edit failed:", editError)
      }
    }
  })

  // ephemeral な deferred を即返して 3 秒制限をクリア（「考え中」表示は実行者にのみ見える）。
  // 成功 embed のみ後から public followup で投稿し、エラー／空はこの ephemeral original の編集で完結する。
  return NextResponse.json({
    type: InteractionResponseType.DeferredChannelMessageWithSource,
    data: { flags: MessageFlags.Ephemeral },
  })
}
