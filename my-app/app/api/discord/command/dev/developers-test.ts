import { NextResponse } from "next/server"
// import { createMentionReactorsModal } from "@/app/domains/user/mentionByReaction/util/createMentionReactorsModal"
import { parseMessageLink } from "@/app/domains/user/mentionByReaction/util/parseMessageLink"
import { getDiscordMessage } from "@/app/_server/lib/discord/api"
import {
  APIApplicationCommandInteractionDataOption,
  APIApplicationCommandInteractionDataBasicOption,
  ComponentType,
  InteractionResponseType,
  InteractionType,
  MessageFlags,
  TextInputStyle,
} from "discord-api-types/v10"

type Option = string | number | boolean

// 型ガード: valueプロパティを持つ基本オプションかどうか
const isBasicOption = (
  opt: APIApplicationCommandInteractionDataOption<InteractionType.ApplicationCommand>,
): opt is APIApplicationCommandInteractionDataBasicOption<InteractionType.ApplicationCommand> => {
  return "value" in opt
}

export const developersTestCommand = async (option?: APIApplicationCommandInteractionDataOption<InteractionType.ApplicationCommand>[]): Promise<NextResponse> => {
  const testNumOption = option?.find((opt) => opt.name === "test_number" && isBasicOption(opt))
  const testNumStr = (testNumOption && isBasicOption(testNumOption) ? testNumOption.value : undefined) ?? "1"
  const testNum = Number(testNumStr)

  const paramOption = option?.find((opt) => opt.name === "url_or_num" && isBasicOption(opt))
  const param = (paramOption && isBasicOption(paramOption) ? paramOption.value : undefined) ?? ""
  console.log("testNum:", testNum, "param:", param)

  switch (testNum) {
    case 1:
      // paramは"num:{num}" を想定
      return handleTestDevelop1(param)
    case 2:
      // paramは"url:{url}" を想定
      return handleTestDevelop2(param)
    case 3:
      // paramは"url:{url}" を想定
      return handleTestDevelop3(param)
    case 4:
      // 中身未実装　自由に使ってね
      return handleTestDevelop4()
    case 5:
      // 中身未実装　自由に使ってね
      return handleTestDevelop5()
    default:
      return NextResponse.json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `テスト番号 ${testNum} は存在しません`,
          flags: MessageFlags.Ephemeral,
        },
      })
  }
}

/**
 * @param option - "{paramName}?{value}" 形式（例: "num?5", "url?https://..."）
 * @param paramName - 抽出したいパラメータ名
 * @returns パラメータの値、見つからない場合は undefined
 */
const extractParam = (option: string, paramName: string): string | undefined => {
  // "num:123" のような形式を想定
  const [name, value] = option.split(":")

  if (name !== paramName) {
    console.error(`[extractParam] パラメータ名が一致しません。期待: ${paramName}, 実際: ${name}`)
    return undefined
  }

  if (!value) {
    console.error(`[extractParam] ${paramName} の値が見つかりません: ${option}`)
    return undefined
  }

  return value
}

const handleTestDevelop1 = (option: Option): NextResponse => {
  if (typeof option != "string") {
    return errorResponseAndConsoleError(`optionの型が不正です。stringである必要があります`)
  }

  const num = extractParam(option, "num")
  const count = Number(num) || 0

  return NextResponse.json({
    type: InteractionResponseType.Modal,
    data: {
      custom_id: "test-label-component-1",
      title: `Test Modal (${count}個のinput)`,
      components: Array.from({ length: count }, (_, i) => ({
        type: ComponentType.Label,
        components: [
          {
            type: ComponentType.TextInput,
            custom_id: `text_input_${i}`,
            label: `text_input ${i}`,
            style: TextInputStyle.Short,
            required: i % 2 === 0 ? true : false,
            placeholder: `入力欄 ${i}`,
            max_length: 10 * (i + 1) * (i + 1),
          },
        ],
      })),
    },
  })
}

// 通信せず、createMentionReactorsModalの返す値がdiscordで正常かどうかのみを確認する
const handleTestDevelop2 = (option: Option): NextResponse => {
  if (typeof option != "string") {
    return errorResponseAndConsoleError(`optionの型が不正です。stringである必要があります`)
  }

  const url = extractParam(option, "url")
  if (url == null) {
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `option 2にてmessageリンクのurlパースに失敗しました "url:{url}"で入力してください`,
        flags: MessageFlags.Ephemeral,
      },
    })
  }

  const parse = parseMessageLink(url)
  if (parse == null) {
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `option 2にてmessageリンクのurlパースに失敗しました "url?{url}"で入力してください`,
        flags: MessageFlags.Ephemeral,
      },
    })
  }

  // const fakeMes = "test2"
  // const fakeReactions = [
  //   { emojiName: "👍", count: 5 },
  //   { emojiName: "❤️", count: 3 },
  //   { emojiName: "😂", count: 2 },
  // ]

  // return NextResponse.json(createMentionReactorsModal(parse.channelId, parse.messageId, fakeMes, fakeReactions))

  return NextResponse.json({
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: "handleTestDevelop2 (未実装)",
      flags: MessageFlags.Ephemeral,
    },
  })
}

// discord apiを1件叩く。それを待ってもdiscord botのレスポンスが間に合うかの確認
const handleTestDevelop3 = async (option: Option): Promise<NextResponse> => {
  if (typeof option != "string") {
    return errorResponseAndConsoleError(`{optionの型が不正です。stringである必要があります`)
  }

  const url = extractParam(option, "url")
  if (url == null) {
    console.error("urlが抽出できませんでした", option)
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `option 3にてmessageリンクのurlパースに失敗しました "url:{url}"で入力してください`,
        flags: MessageFlags.Ephemeral,
      },
    })
  }

  const parsed = parseMessageLink(url)
  if (parsed == null) {
    console.error("urlをparseできませんでした", parsed)
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `option 3にてmessageリンクのurlパースに失敗しました "url:{url}"で入力してください`,
        flags: MessageFlags.Ephemeral,
      },
    })
  }

  try {
    const message = await getDiscordMessage(parsed.channelId, parsed.messageId)
    if (!message.reactions || message.reactions.length === 0) {
      console.log("メッセージにリアクションがありません")
      return NextResponse.json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "メッセージにリアクションがありません",
          flags: MessageFlags.Ephemeral,
        },
      })
    }

    // 正常系: メッセージの内容を返す
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: message.content,
        flags: MessageFlags.Ephemeral,
      },
    })
  } catch (error) {
    console.error("mentionReactorsCommand has Error:", error)
    console.error("mentionReactorsCommand has Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "リンクが間違っているか、閲覧権限がありません",
        flags: MessageFlags.Ephemeral,
      },
    })
  }
}

const handleTestDevelop4 = (): NextResponse => {
  // モーダル内でテキスト入力コンポーネントを使用
  return NextResponse.json({
    type: InteractionResponseType.Modal,
    data: {
      custom_id: "modal-test-3",
      title: "Modal with Text Input",
      components: [
        // ActionRow + TextInput
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.TextInput,
              custom_id: "text_input_test",
              label: "テキスト入力",
              style: TextInputStyle.Short,
              required: false,
              placeholder: "入力欄",
            },
          ],
        },
      ],
    },
  })
}

const handleTestDevelop5 = (): NextResponse => {
  return NextResponse.json({
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: "handleTestDevelop5 (未実装)",
      flags: MessageFlags.Ephemeral,
    },
  })
}

function errorResponseAndConsoleError(errorString: string) {
  console.error(errorString)
  return NextResponse.json({
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: errorString,
      flags: MessageFlags.Ephemeral,
    },
  })
}
