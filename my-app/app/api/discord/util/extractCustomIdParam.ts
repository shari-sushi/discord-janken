/**
 * custom_idからクエリパラメータを抽出
 * この関数はexportせず、wrapperを作ってexportする
 * @param customId - Discord custom_id（例: "action_name?param1=value1&param2=value2"）
 * @param paramName - 抽出したいパラメータ名
 * @returns パラメータの値、見つからない場合は undefined
 */
// 未発見は正常な戻り値（このパラメータを持たない custom_id もある）ため、デフォルトはログを出さない。
// 「このアクションでは必須」と分かっている呼び出し側だけ warnIfMissing を渡してエラーログを出す。
type ExtractOptions = { warnIfMissing?: boolean }

const extractParam = (customId: string, paramName: string, options?: ExtractOptions): string | undefined => {
  const params = new URLSearchParams(customId.split("?")[1] || "")
  const value = params.get(paramName)

  if (!value) {
    if (options?.warnIfMissing) {
      console.error(`[extractParam] ${paramName} が抽出できませんでした: ${customId}`)
    }
    return undefined
  }

  return value
}

export const extractMatchId = (customId: string, options?: ExtractOptions): string | undefined => {
  return extractParam(customId, "match_id", options)
}

export const extractMessageId = (customId: string, options?: ExtractOptions): string | undefined => {
  return extractParam(customId, "message_id", options)
}

export const extractType = (customId: string, options?: ExtractOptions): string | undefined => {
  return extractParam(customId, "type", options)
}

export const extractInviteToken = (customId: string, options?: ExtractOptions): string | undefined => {
  return extractParam(customId, "invite", options)
}
