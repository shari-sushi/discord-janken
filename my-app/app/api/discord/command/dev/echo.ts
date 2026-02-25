import { NextResponse } from "next/server"
import { InteractionResponseType } from "discord-interactions"

type Arg = {
  name: string
  value: string
}

export const echoCommand = (options: Arg[]): NextResponse => {
  const text = options?.find((opt: Arg) => opt.name === "text")?.value || ""

  return NextResponse.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: text,
    },
  })
}
