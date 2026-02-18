import { NextResponse } from "next/server"

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
        type: 4,
        data: { content: `テスト番号 ${number} は存在しません`, flags: 64 },
      })
  }
}

const handleTestDevelop1 = (): NextResponse => {
  // モーダルなしでString Selectを表示（通常のメッセージとして）
  return NextResponse.json({
    type: 4, // メッセージ返信
    data: {
      content: "String Selectのテスト（モーダルなし）",
      components: [
        {
          type: 1, // Action Row
          components: [
            {
              type: 3, // String Select
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
      flags: 64, // Ephemeral（送信者のみに表示）
    },
  })
}

const handleTestDevelop2 = (): NextResponse => {
  // モーダル内でString Selectを使用（Labelなし・従来の方法）
  // 注意: Discordはモーダル内でのString Select使用時にLabelコンポーネントを推奨
  return NextResponse.json({
    type: 9, // Modal
    data: {
      custom_id: "modal-test-2",
      title: "Modal with String Select",
      components: [
        {
          type: 1, // Action Row
          components: [
            {
              type: 4, // Text Input
              custom_id: "text_input_test",
              label: "テキスト入力",
              style: 1, // Short
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
    type: 9, // Modal
    data: {
      custom_id: "modal-test-3",
      title: "Label + String Select Test",
      components: [
        // パターン1: Label + String Select（公式ドキュメント推奨構造）
        {
          type: 18, // Label
          label: "好きな虫を選択してください",
          component: {
            type: 3, // String Select
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
          type: 18, // Label
          label: "好きな色を選択",
          component: {
            type: 3, // String Select
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
    type: 9, // Modal
    data: {
      custom_id: "test-label-component-4",
      title: "Text Input + 4 Selectors",
      components: [
        // Text Input（従来のAction Row構造）
        {
          type: 1, // Action Row
          components: [
            {
              type: 4, // Text Input
              custom_id: "text_input_name",
              label: "名前を入力",
              style: 1, // Short
              required: true,
              placeholder: "あなたの名前",
              max_length: 50,
            },
          ],
        },
        // Label + String Select 1
        {
          type: 18, // Label
          label: "好きな虫を選択",
          component: {
            type: 3, // String Select
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
          type: 18, // Label
          label: "好きな色を選択",
          component: {
            type: 3, // String Select
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
          type: 18, // Label
          label: "好きな果物を選択",
          component: {
            type: 3, // String Select
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
          type: 18, // Label
          label: "好きな動物を選択",
          component: {
            type: 3, // String Select
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
    type: 4, // メッセージ返信
    data: {
      content: "handleTestDevelop5 (未実装)",
      flags: 64, // Ephemeral
    },
  })
}
