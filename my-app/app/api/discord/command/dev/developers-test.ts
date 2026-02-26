import { NextResponse } from "next/server"
import { InteractionResponseType, InteractionResponseFlags, MessageComponentTypes, TextStyleTypes } from "discord-interactions"

export const developersTestCommand = (number: number): NextResponse => {
  switch (number) {
    case 1:
      return handleTestDevelop1()
    case 2:
      return handleTestDevelop2()
    case 3:
      return handleTestDevelop3()
    case 4:
      return handleTestDevelop4()
    case 5:
      return handleTestDevelop5()
    default:
      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: `テスト番号 ${number} は存在しません`, flags: InteractionResponseFlags.EPHEMERAL },
      })
  }
}

const handleTestDevelop1 = (): NextResponse => {
  // モーダルなしでString Selectを表示（通常のメッセージとして）
  return NextResponse.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: "String Selectのテスト（モーダルなし）",
      components: [
        {
          type: MessageComponentTypes.ACTION_ROW,
          components: [
            {
              type: MessageComponentTypes.STRING_SELECT,
              custom_id: "favorite_bug",
              placeholder: "Favorite bug?",
              options: [
                {
                  label: "Ant",
                  value: "ant",
                  description: "(best option)",
                  emoji: { name: "🐜" },
                },
                {
                  label: "Butterfly",
                  value: "butterfly",
                  emoji: { name: "🦋" },
                },
                {
                  label: "Caterpillar",
                  value: "caterpillar",
                  emoji: { name: "🐛" },
                },
              ],
            },
          ],
        },
      ],
      flags: InteractionResponseFlags.EPHEMERAL,
    },
  })
}

const handleTestDevelop2 = (): NextResponse => {
  // モーダル内でString Selectを使用（Labelなし・従来の方法）
  // 注意: Discordはモーダル内でのString Select使用時にLabelコンポーネントを推奨
  return NextResponse.json({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: "modal-test-2",
      title: "Modal with String Select",
      components: [
        {
          type: MessageComponentTypes.ACTION_ROW,
          components: [
            {
              type: MessageComponentTypes.INPUT_TEXT,
              custom_id: "text_input_test",
              label: "テキスト入力",
              style: TextStyleTypes.SHORT,
              required: false,
              placeholder: "何か入力してください",
            },
          ],
        },
      ],
    },
  })
}

const handleTestDevelop3 = (): NextResponse => {
  // Discord公式ドキュメント準拠: https://docs.discord.com/developers/components/reference#label
  // Modal内でString Selectを使用する場合は、Labelコンポーネント（type: 18）内に配置する必要がある
  return NextResponse.json({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: "modal-test-3",
      title: "Label + String Select Test",
      components: [
        // パターン1: Label + String Select（公式ドキュメント推奨構造）
        {
          type: MessageComponentTypes.LABEL,
          label: "好きな虫を選択してください",
          component: {
            type: MessageComponentTypes.STRING_SELECT,
            custom_id: "favorite_bug",
            placeholder: "虫を選んでください",
            options: [
              {
                label: "アリ",
                value: "ant",
                description: "働き者の昆虫",
                emoji: { name: "🐜" },
              },
              {
                label: "チョウ",
                value: "butterfly",
                description: "美しい羽を持つ昆虫",
                emoji: { name: "🦋" },
              },
            ],
          },
        },
        // パターン2: Label + String Select（複数選択オプション付き）
        {
          type: MessageComponentTypes.LABEL,
          label: "好きな色を選択",
          component: {
            type: MessageComponentTypes.STRING_SELECT,
            custom_id: "favorite_color",
            placeholder: "色を選んでください",
            min_values: 1,
            max_values: 2,
            options: [
              { label: "赤", value: "red" },
              { label: "青", value: "blue" },
              { label: "緑", value: "green" },
              { label: "黄", value: "yellow" },
            ],
          },
        },
      ],
    },
  })
}

const handleTestDevelop4 = (): NextResponse => {
  // Text Input 1つ + Label + String Select 4つの組み合わせテスト
  return NextResponse.json({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: "test-label-component-4",
      title: "Text Input + 4 Selectors",
      components: [
        // Text Input（従来のAction Row構造）
        {
          type: MessageComponentTypes.ACTION_ROW,
          components: [
            {
              type: MessageComponentTypes.INPUT_TEXT,
              custom_id: "text_input_name",
              label: "名前を入力",
              style: TextStyleTypes.SHORT,
              required: true,
              placeholder: "あなたの名前",
              max_length: 50,
            },
          ],
        },
        // Label + String Select 1
        {
          type: MessageComponentTypes.LABEL,
          label: "好きな虫を選択",
          component: {
            type: MessageComponentTypes.STRING_SELECT,
            custom_id: "favorite_bug",
            placeholder: "虫を選んでください",
            options: [
              { label: "アリ", value: "ant", emoji: { name: "🐜" } },
              { label: "チョウ", value: "butterfly", emoji: { name: "🦋" } },
              { label: "イモムシ", value: "caterpillar", emoji: { name: "🐛" } },
            ],
          },
        },
        // Label + String Select 2
        {
          type: MessageComponentTypes.LABEL,
          label: "好きな色を選択",
          component: {
            type: MessageComponentTypes.STRING_SELECT,
            custom_id: "favorite_color",
            placeholder: "色を選んでください",
            options: [
              { label: "赤", value: "red" },
              { label: "青", value: "blue" },
              { label: "緑", value: "green" },
            ],
          },
        },
        // Label + String Select 3
        {
          type: MessageComponentTypes.LABEL,
          label: "好きな果物を選択",
          component: {
            type: MessageComponentTypes.STRING_SELECT,
            custom_id: "favorite_fruit",
            placeholder: "果物を選んでください",
            options: [
              { label: "リンゴ", value: "apple", emoji: { name: "🍎" } },
              { label: "バナナ", value: "banana", emoji: { name: "🍌" } },
              { label: "オレンジ", value: "orange", emoji: { name: "🍊" } },
            ],
          },
        },
        // Label + String Select 4
        {
          type: MessageComponentTypes.LABEL,
          label: "好きな動物を選択",
          component: {
            type: MessageComponentTypes.STRING_SELECT,
            custom_id: "favorite_animal",
            placeholder: "動物を選んでください",
            options: [
              { label: "犬", value: "dog", emoji: { name: "🐶" } },
              { label: "猫", value: "cat", emoji: { name: "🐱" } },
              { label: "鳥", value: "bird", emoji: { name: "🐦" } },
            ],
          },
        },
      ],
    },
  })
}

const handleTestDevelop5 = (): NextResponse => {
  // TODO: 実装予定
  return NextResponse.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: "handleTestDevelop5 (未実装)",
      flags: InteractionResponseFlags.EPHEMERAL,
    },
  })
}
