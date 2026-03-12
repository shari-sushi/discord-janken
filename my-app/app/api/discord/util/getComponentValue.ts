import { APIModalSubmission, APIModalSubmissionComponent, ComponentType, ModalSubmitActionRowComponent, ModalSubmitLabelComponent, ModalSubmitComponent } from "discord-api-types/v10"

/**
 * 型ガード: ActionRow かどうか
 */
const isActionRow = (component: APIModalSubmissionComponent): component is ModalSubmitActionRowComponent => {
  return component.type === ComponentType.ActionRow
}

/**
 * 型ガード: Label かどうか
 */
const isLabel = (component: APIModalSubmissionComponent): component is ModalSubmitLabelComponent => {
  return component.type === ComponentType.Label
}

/**
 * discordから送られてきたデータから custom_id で値を取得
 * @param customId - 検索する custom_id（前方一致）
 * @param data - モーダル送信データ
 * @returns 取得した値（Text Input の value または Select Menu の values[0]）
 * https://docs.discord.com/developers/interactions/receiving-and-responding#interaction-object-modal-submit-data-structure
 */
export function getValue(customId: string, data: APIModalSubmission | undefined): string | undefined {
  const components = data?.components
  if (!components) {
    console.error(`[getValue] custom_id="${customId}" 取得失敗: data.components が存在しません`, `data:`, JSON.stringify(data, null, 2))
    return undefined
  }

  const component = components
    .flatMap((row: APIModalSubmissionComponent): ModalSubmitComponent[] => {
      if (isActionRow(row)) return row.components
      if (isLabel(row)) return [row.component]

      return []
    })
    .find((c: ModalSubmitComponent) => c.custom_id.startsWith(customId))

  if (!component) {
    console.error(`[getValue] custom_id="${customId}" 取得失敗: コンポーネントが見つかりません`, `data.components:`, JSON.stringify(components, null, 2))
    return undefined
  }

  // Text Input の場合は value、Select Menu の場合は values[0]
  if ("value" in component) {
    return typeof component.value === "string" ? component.value : String(component.value)
  }
  if ("values" in component) {
    return component.values[0]
  }
  return undefined
}
