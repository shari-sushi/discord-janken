/**
 * Discord REST API 通信用のヘルパー関数
 */

import { APIActionRowComponent, APIAllowedMentions, APIComponentInMessageActionRow, MessageFlags } from "discord-api-types/v10"
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
  allowed_mentions?: APIAllowedMentions
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
      throw new DiscordApiError(response.status, response.statusText, { emoji, ...errorData })
    }

    const data = await response.json()
    return data as DiscordReactor[]
  } catch (error) {
    if (error instanceof DiscordApiError) {
      throw error
    }
    throw new Error(`Failed to get message reactions (emoji: ${emoji}): ${error}`)
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
 * 特定のリアクションをつけたユーザー一覧を取得する
 * @param channelId - チャンネルID
 * @param messageId - メッセージID
 * @param emoji - 絵文字
 * @returns リアクションをつけたユーザーの配列
 */
export async function getReactionUsers(channelId: string, messageId: string, emoji: string): Promise<DiscordReactor[]> {
  return getMessageReactions(channelId, messageId, emoji)
}

/**
 * メッセージにリアクションを追加する
 * @param channelId - チャンネルID
 * @param messageId - メッセージID
 * @param emoji - 絵文字
 */
export async function addReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
  const url = `${DISCORD_API_BASE_URL}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new DiscordApiError(response.status, response.statusText, errorData)
  }
}

/**
 * メッセージに複数のリアクションを順番に追加する
 * レートリミット発生時は retry_after 秒待機してリトライする
 * リアクションについては通常のrate limitより厳しい。コミュニティ実測値では0.25s~0.3sが必要とのこと。
 * @see https://discord.com/developers/docs/topics/rate-limits （"Routes for controlling emojis" セクション）
 * @see https://github.com/discord/discord-api-docs/issues/395
 * 実際に、0.1s間隔では2リクエスト目で429が必ず返って来た。
 * @param channelId - チャンネルID
 * @param messageId - メッセージID
 * @param emojis - 絵文字の配列
 * @param intervalMs - リアクション間の待機時間（ミリ秒）
 */
export const addReactions = async (channelId: string, messageId: string, emojis: string[], intervalMs = 300): Promise<void> => {
  for (const emoji of emojis) {
    await retryAfterRateLimit(() => addReaction(channelId, messageId, emoji))
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

/**
 * メッセージの全リアクションを削除する
 * @param channelId - チャンネルID
 * @param messageId - メッセージID
 */
export async function deleteAllReactions(channelId: string, messageId: string): Promise<void> {
  const url = `${DISCORD_API_BASE_URL}/channels/${channelId}/messages/${messageId}/reactions`

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new DiscordApiError(response.status, response.statusText, errorData)
  }
}

/**
 * Webhookを通じて元のインタラクションレスポンスメッセージを取得する
 * @param applicationId - アプリケーションID
 * @param token - インタラクショントークン
 * @returns 元メッセージのデータ
 */
export async function getWebhookOriginalMessage(applicationId: string, token: string): Promise<DiscordMessageResponse> {
  const url = `${DISCORD_API_BASE_URL}/webhooks/${applicationId}/${token}/messages/@original`

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new DiscordApiError(response.status, response.statusText, errorData)
  }

  return response.json()
}

/**
 * Webhookを通じて元のインタラクションレスポンスメッセージを編集する
 * @param applicationId - アプリケーションID
 * @param token - インタラクショントークン
 * @param content - メッセージ本文
 * @param components - コンポーネント配列
 * @param allowedMentions - メンション解釈の制御（例: `{ parse: [] }` で @everyone 等のピングを全抑止）
 */
export async function editWebhookOriginalMessage(
  applicationId: string,
  token: string,
  content: string,
  components?: APIActionRowComponent<APIComponentInMessageActionRow>[],
  allowedMentions?: APIAllowedMentions,
): Promise<void> {
  const url = `${DISCORD_API_BASE_URL}/webhooks/${applicationId}/${token}/messages/@original`

  const body: DiscordMessageBody = { content }
  if (components && components.length > 0) {
    body.components = components
  }
  if (allowedMentions) {
    body.allowed_mentions = allowedMentions
  }

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
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
 * Webhookを通じてインタラクションの followup メッセージを送信する。
 * 元の応答が ephemeral でも、ここで ephemeral=false にすれば public なメッセージを投稿できる。
 * （初回が ephemeral deferred のスラッシュコマンドから、public な募集メッセージを出す用途）
 * @param applicationId - アプリケーションID
 * @param token - インタラクショントークン
 * @param content - メッセージ本文
 * @param components - コンポーネント配列
 * @param ephemeral - true で本人にのみ表示（既定: false = public）
 * @param allowedMentions - メンション解釈の制御（例: `{ parse: [] }` で @everyone 等のピングを全抑止）
 */
export async function createFollowupMessage(
  applicationId: string,
  token: string,
  content: string,
  components?: APIActionRowComponent<APIComponentInMessageActionRow>[],
  ephemeral = false,
  allowedMentions?: APIAllowedMentions,
): Promise<void> {
  const url = `${DISCORD_API_BASE_URL}/webhooks/${applicationId}/${token}`

  const body: DiscordMessageBody & { flags?: MessageFlags } = { content }
  if (components && components.length > 0) {
    body.components = components
  }
  if (ephemeral) {
    body.flags = MessageFlags.Ephemeral
  }
  if (allowedMentions) {
    body.allowed_mentions = allowedMentions
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
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
 * Discord APIのレートリミット（429）発生時に retry_after 秒待機してリトライする
 * Next.js の after関数とは無関係なので注意
 * @param fn - 実行する非同期関数
 * @returns 関数の実行結果
 */
export const retryAfterRateLimit = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof DiscordApiError && error.status === 429) {
      const retryAfter = (error.details as { retry_after?: number })?.retry_after ?? 1
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
      return await fn()
    }
    throw error
  }
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
