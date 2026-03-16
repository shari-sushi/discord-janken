import { NextResponse } from "next/server"
import { APIApplicationCommandInteractionDataOption, APIApplicationCommandInteractionDataBasicOption, APIInteractionResponse, InteractionType, InteractionResponseType } from "discord-api-types/v10"

// 型ガード: "text" という名前で value プロパティを持つ基本オプションかどうか
const isTextOption = (
  opt: APIApplicationCommandInteractionDataOption<InteractionType.ApplicationCommand>,
): opt is APIApplicationCommandInteractionDataBasicOption<InteractionType.ApplicationCommand> => {
  return opt.name === "text" && "value" in opt
}

export const echoCommand = (options?: APIApplicationCommandInteractionDataOption<InteractionType.ApplicationCommand>[]): NextResponse<APIInteractionResponse> => {
  if (options == null) {
    console.error()
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "optionが必要です",
      },
    })
  }

  const textOption = options?.find(isTextOption)
  const text = textOption ? String(textOption.value) : ""

  return NextResponse.json({
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: text,
    },
  })
}
