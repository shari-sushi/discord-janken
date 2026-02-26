import { InteractionData, MessageComponentData } from "@/app/_server/lib/discord/types"

/**
 * discordから送られてきたデータから custom_id で値を取得
 * @param customId - 検索する custom_id（前方一致）
 * @param data - モーダル送信データ
 * @returns 取得した値（Text Input の value または Select Menu の values[0]）
 * https://docs.discord.com/developers/interactions/receiving-and-responding#interaction-object-modal-submit-data-structure
 */
export function getValue(customId: string, data: InteractionData | undefined): string | undefined {
  const components = data?.components as MessageComponentData[] | undefined
  if (!components) {
    console.error(`[getValue] custom_id="${customId}" 取得失敗: data.components が存在しません`, `data:`, JSON.stringify(data, null, 2))
    return undefined
  }

  const component = components
    .flatMap((row: MessageComponentData) => {
      // Text Input の場合: row.components (配列)
      if (row.components) {
        return row.components
      }
      // Select Menu の場合: row.component (単数形オブジェクト)
      if (row.component) {
        return [row.component]
      }
      return []
    })
    .find((c: MessageComponentData) => c?.custom_id?.startsWith(customId))

  if (!component) {
    console.error(`[getValue] custom_id="${customId}" 取得失敗: コンポーネントが見つかりません`, `data.components:`, JSON.stringify(components, null, 2))
    return undefined
  }

  // Text Input の場合は value、Select Menu の場合は values[0]
  return component?.value ?? component?.values?.[0]
}
