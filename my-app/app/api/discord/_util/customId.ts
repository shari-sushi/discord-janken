/**
 * custom_id ビルダー（Fluent Interface）
 */
type CustomIdBuilder = {
  matchId: (value: string) => string
  messageId: (value: string) => string
  type: (value: string) => string
}

export const customId = (baseActionId: string): CustomIdBuilder => {
  const queryParts: string[] = []

  const buildFinal = (): string => `${baseActionId}?${queryParts.join("&")}`

  return {
    matchId: (value: string) => {
      queryParts.push(`match_id=${value}`)
      return buildFinal()
    },
    messageId: (value: string) => {
      queryParts.push(`message_id=${value}`)
      return buildFinal()
    },
    type: (value: string) => {
      queryParts.push(`type=${value}`)
      return buildFinal()
    },
  }
}
