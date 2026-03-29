import { NextResponse } from "next/server"
import { InteractionResponseType } from "discord-api-types/v10"

export const randomSideCommand = (): NextResponse => {
  const isBlue = Math.random() < 0.5
  const side = isBlue ? "🔵 ブルーサイド" : "🔴 レッドサイド"

  return NextResponse.json({
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: `抽選結果：**${side}**`,
    },
  })
}
