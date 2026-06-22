import { NextResponse } from "next/server"
import {
  InteractionResponseType,
  MessageFlags,
  ComponentType,
  ButtonStyle,
  type APIChatInputApplicationCommandInteraction,
  type APIMessageComponentInteraction,
  type APIUser,
} from "discord-api-types/v10"
import { createMagicLinkUrl, MAGIC_LINK_TTL } from "@/app/_domains/teamSchedules/_server/magicLink"
import { CLIENT_ACTIONS } from "@/app/_server/util/commands"

/** コマンド／ボタン共通でユーザー情報を取り出す（DM・サーバーどちらからでも呼べる） */
function extractUser(user: APIUser | undefined): { discordUserId?: string; username: string } {
  return {
    discordUserId: user?.id,
    username: user?.global_name ?? user?.username ?? "Discordユーザー",
  }
}

/**
 * ワンタイムトークンを発行し、本人にだけ届く ephemeral 返信でログイン用URLを返す。
 * コマンド初回・再発行ボタンの両方から呼ばれる共通処理。
 *
 * 3秒以内応答のため、トークン生成 + Redis保存 + ephemeral返信のみの軽量処理に留める。
 */
async function buildLoginLinkResponse(user: APIUser | undefined): Promise<NextResponse> {
  const { discordUserId, username } = extractUser(user)

  if (!discordUserId) {
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: "ユーザー情報を取得できませんでした。再度お試しください。", flags: MessageFlags.Ephemeral },
    })
  }

  const url = await createMagicLinkUrl(discordUserId, username)
  const expiryMinutes = Math.round(MAGIC_LINK_TTL / 60)

  return NextResponse.json({
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: ["🔑 チーム活動 スケジュール調整のログイン用リンクです（他の人に教えないでください）。", "", `${url}`, "", `-# 有効期限: ${expiryMinutes}分・1回のみ有効`].join("\n"),
      flags: MessageFlags.Ephemeral,
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button,
              style: ButtonStyle.Secondary,
              label: "リンクを再発行",
              custom_id: CLIENT_ACTIONS.TEAM_SCHEDULE.REISSUE_LOGIN,
            },
          ],
        },
      ],
    },
  })
}

/**
 * `/team-schedule-login` コマンド。
 * ログイン用リンクを ephemeral で発行する。
 */
export async function teamScheduleLoginCommand(interaction: APIChatInputApplicationCommandInteraction): Promise<NextResponse> {
  return buildLoginLinkResponse(interaction.member?.user ?? interaction.user)
}

/**
 * 「リンクを再発行」ボタン。コマンドを叩き直したのと同じく、新しいワンタイムリンクを発行する。
 */
export async function handleReissueLoginButton(interaction: APIMessageComponentInteraction): Promise<NextResponse> {
  return buildLoginLinkResponse(interaction.member?.user ?? interaction.user)
}
