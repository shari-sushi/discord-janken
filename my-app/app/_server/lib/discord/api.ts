/**
 * Discord REST API 通信用のヘルパー関数
 */

import { APIActionRowComponent, APIComponentInMessageActionRow } from "discord-api-types/v10"
import { DISCORD_API_BASE_URL, DISCORD_BOT_TOKEN } from "@/app/_server/lib/env"

export interface DiscordMessageResponse {
  id: string
  channel_id: string
  content: string
  [key: string]: unknown
}

export interface DiscordReaction {
  emoji: {
    id: string | null
    name: string | null
  }
  count: number
  me: boolean
}

export interface DiscordReactor {
  id: string
  username: string
  discriminator: string
  avatar: string | null
}

export class DiscordApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public details?: unknown,
  ) {
    super(`Discord API Error: ${status} ${statusText}`)
    this.name = "DiscordApiError"
  }
}

interface DiscordMessageBody {
  content: string
  components?: APIActionRowComponent<APIComponentInMessageActionRow>[]
}

/**
 * Discordチャンネルにメッセージを送信する
 * @param channelId - 送信先のチャンネルID
 * @param content - メッセージ本文
 * @param components - ボタンなどのコンポーネント配列
 * @returns Discord APIからのレスポンス（message_id等）
 */
export async function sendDiscordMessage(channelId: string, content: string, components?: APIActionRowComponent<APIComponentInMessageActionRow>[]): Promise<DiscordMessageResponse> {
  const url = `${DISCORD_API_BASE_URL}/channels/${channelId}/messages`

  const body: DiscordMessageBody = {
    content,
  }

  if (components && components.length > 0) {
    body.components = components
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new DiscordApiError(response.status, response.statusText, errorData)
    }

    const data = await response.json()
    return data as DiscordMessageResponse
  } catch (error) {
    if (error instanceof DiscordApiError) {
      throw error
    }
    throw new Error(`Failed to send Discord message: ${error}`)
  }
}

/**
 * Discordのメッセージを編集する（PATCH）
 * @param channelId - チャンネルID
 * @param messageId - 編集対象のメッセージID
 * @param content - 新しいメッセージ本文
 * @param components - 新しいコンポーネント配列
 */
export async function editDiscordMessage(channelId: string, messageId: string, content: string, components?: APIActionRowComponent<APIComponentInMessageActionRow>[]): Promise<void> {
  const url = `${DISCORD_API_BASE_URL}/channels/${channelId}/messages/${messageId}`

  const body: DiscordMessageBody = { content }

  if (components && components.length > 0) {
    body.components = components
  }

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new DiscordApiError(response.status, response.statusText, errorData)
  }
}

/**
 * Discordのメッセージを取得する
 * @param channelId - チャンネルID
 * @param messageId - メッセージID
 * @returns メッセージ情報（content, reactions等を含む）
 */
export async function getDiscordMessage(channelId: string, messageId: string): Promise<DiscordMessageResponse & { reactions?: DiscordReaction[] }> {
  const url = `${DISCORD_API_BASE_URL}/channels/${channelId}/messages/${messageId}`

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new DiscordApiError(response.status, response.statusText, errorData)
    }

    const data = await response.json()
    return data
  } catch (error) {
    if (error instanceof DiscordApiError) {
      throw error
    }
    throw new Error(`Failed to get Discord message: ${error}`)
  }
}

/**
 * 特定のリアクションをつけたユーザー一覧を取得する（内部使用）
 * @param channelId - チャンネルID
 * @param messageId - メッセージID
 * @param emoji - 絵文字（カスタム絵文字の場合は `name:id` 形式）
 * @returns リアクションをつけたユーザーの配列
 */
async function getMessageReactions(channelId: string, messageId: string, emoji: string): Promise<DiscordReactor[]> {
  const url = `${DISCORD_API_BASE_URL}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new DiscordApiError(response.status, response.statusText, errorData)
    }

    const data = await response.json()
    return data as DiscordReactor[]
  } catch (error) {
    if (error instanceof DiscordApiError) {
      throw error
    }
    throw new Error(`Failed to get message reactions: ${error}`)
  }
}

/**
 * 絵文字をエンコード用文字列に変換する
 * @param reaction - Discord リアクション情報
 * @returns エンコードされた絵文字文字列
 */
function encodeEmoji(reaction: DiscordReaction): string {
  // カスタム絵文字の場合は `name:id` 形式
  if (reaction.emoji.id) {
    return `${reaction.emoji.name}:${reaction.emoji.id}`
  }
  // 通常の絵文字の場合はそのまま
  return reaction.emoji.name || ""
}

/**
 * メッセージの全リアクションについて、ユーザー情報を並列取得する
 * @param channelId - チャンネルID
 * @param messageId - メッセージID
 * @param reactions - リアクション配列
 * @returns リアクションフィールドデータの配列
 */
export async function getAllReactionFields(channelId: string, messageId: string, reactions: DiscordReaction[]): Promise<Array<{ emojiName: string; count: number; userIds: string[] }>> {
  return await Promise.all(
    reactions.map(async (reaction) => {
      const emojiEncoded = encodeEmoji(reaction)
      const users = await getMessageReactions(channelId, messageId, emojiEncoded)

      return {
        emojiName: reaction.emoji.name || "?",
        count: reaction.count,
        userIds: users.map((user) => user.id),
      }
    }),
  )
}

/**
 * インタラクションのFollow-upメッセージを送信する
 * @param interactionToken - インタラクショントークン
 * @param content - メッセージ本文
 */
export async function sendFollowupMessage(interactionToken: string, content: string): Promise<void> {
  // TODO: 実装
  console.log("sendFollowupMessage called with:", { interactionToken, content })
}
