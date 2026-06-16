/**
 * custom_idからクエリパラメータを抽出
 * この関数はexportせず、wrapperを作ってexportする
 * @param customId - Discord custom_id（例: "action_name?param1=value1&param2=value2"）
 * @param paramName - 抽出したいパラメータ名
 * @returns パラメータの値、見つからない場合は undefined
 */
const extractParam = (customId: string, paramName: string): string | undefined => {
  const params = new URLSearchParams(customId.split("?")[1] || "")
  const value = params.get(paramName)

  if (!value) {
    console.error(`[extractParam] ${paramName} が抽出できませんでした: ${customId}`)
    return undefined
  }

  return value
}

export const extractMatchId = (customId: string): string | undefined => {
  return extractParam(customId, "match_id")
}

export const extractMessageId = (customId: string): string | undefined => {
  return extractParam(customId, "message_id")
}

export const extractType = (customId: string): string | undefined => {
  return extractParam(customId, "type")
}

export const extractInviteToken = (customId: string): string | undefined => {
  return extractParam(customId, "invite")
}
