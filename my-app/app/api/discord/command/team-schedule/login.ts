import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { InteractionResponseType, MessageFlags, type APIChatInputApplicationCommandInteraction } from "discord-api-types/v10"
import { redisSet } from "@/app/_server/lib/redis/redis"
import { magicLinkKey } from "@/app/_domains/teamSchedules/_server/redisKeys"
import { APP_URL } from "@/app/_server/lib/env"

const MAGIC_LINK_TTL = 600 // 10分

/** Redis に保存する magic-link の中身（auth/verify で利用） */
export type MagicLinkPayload = {
  discordUserId: string
  username: string
}

/**
 * `/team-schedule-login` コマンド。
 * Discord ユーザーごとにワンタイムトークンを発行し、本人にだけ届く ephemeral 返信で
 * ログイン用URL（`${APP_URL}/team_schedules?token={token}`）を案内する。
 *
 * 3秒以内応答のため、トークン生成 + Redis保存 + ephemeral返信のみの軽量処理に留める。
 */
export async function teamScheduleLoginCommand(interaction: APIChatInputApplicationCommandInteraction): Promise<NextResponse> {
  // DM・サーバーどちらからでも呼べるよう member.user / user の両方を見る
  const user = interaction.member?.user ?? interaction.user
  const discordUserId = user?.id
  const username = user?.global_name ?? user?.username ?? "Discordユーザー"

  if (!discordUserId) {
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: "ユーザー情報を取得できませんでした。再度お試しください。", flags: MessageFlags.Ephemeral },
    })
  }

  const token = randomBytes(32).toString("hex")
  const payload: MagicLinkPayload = { discordUserId, username }
  await redisSet(magicLinkKey(token), payload, MAGIC_LINK_TTL)

  const url = `${APP_URL}/team_schedules?token=${token}`

  return NextResponse.json({
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: [
        "🔑 スクリム調整のログイン用リンクです（あなたにだけ表示されています）。",
        "",
        url,
        "",
        "※ このリンクは10分間・1回のみ有効です。",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    },
  })
}
