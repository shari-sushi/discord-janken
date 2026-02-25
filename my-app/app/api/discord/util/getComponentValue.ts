import { InteractionData, MessageComponentData } from "@/app/api/discord/types"

/**
 * モーダル送信データから custom_id で値を取得
 * @param customId - 検索する custom_id（前方一致）
 * @param data - モーダル送信データ
 * @returns 取得した値（Text Input の value または Select Menu の values[0]）
 */
export function getComponentValue(customId: string, data: InteractionData): string | undefined {
  const components = data.components ?? []

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

  // Text Input の場合は value、Select Menu の場合は values[0]
  return component?.value ?? component?.values?.[0]
}
