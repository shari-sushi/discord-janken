import { MessageLinkParsed } from "@/app/domains/user/mentionByReaction/types"

/**
 * Discord メッセージリンクをパースする
 * @param link - Discord メッセージリンク
 * @returns パース結果、または null（不正なリンクの場合）
 */
export function parseMessageLink(link: string): MessageLinkParsed | null {
  const messageLinkRegex = /discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/
  const match = link.match(messageLinkRegex)

  if (!match) {
    return null
  }

  return {
    guildId: match[1],
    channelId: match[2],
    messageId: match[3],
  }
}
