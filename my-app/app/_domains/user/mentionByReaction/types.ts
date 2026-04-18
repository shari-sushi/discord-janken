export interface MessageLinkParsed {
  guildId: string
  channelId: string
  messageId: string
}

export interface ReactionUser {
  id: string
  username: string
}

export interface ReactionFieldData {
  emojiName: string
  count: number
  userIds: string[]
}
