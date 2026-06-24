/**
 * Discord REST API 通信用のヘルパー関数
 */

import { APIActionRowComponent, APIAllowedMentions, APIComponentInMessageActionRow, APIEmbed, MessageFlags } from "discord-api-types/v10"
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
  embeds?: APIEmbed[]
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
 * リアクションユーザー取得の 1 リクエストあたり上限（Discord の最大値）。
 * @see https://discord.com/developers/docs/resources/message#get-reactions-query-string-params
 */
const REACTION_USERS_PAGE_LIMIT = 100

/**
 * 特定のリアクションをつけたユーザーを「1 ページ分」取得する（内部使用）。
 * limit を明示しないと Discord の default が 25 件になり 26 件目以降を取りこぼすため、必ず付与する。
 * 429 は呼び出し側ではなくこの関数自身が retryAfterRateLimit で吸収する（GET 経路の 429 保護を一本化）。
 * @param channelId - チャンネルID
 * @param messageId - メッセージID
 * @param emoji - 絵文字（カスタム絵文字の場合は `name:id` 形式）
 * @param options.limit - 1 ページの取得上限（既定 100 = Discord 最大値）
 * @param options.after - このユーザーID より後ろを取得（ページネーション用）
 * @returns リアクションをつけたユーザーの配列（最大 limit 件）
 */
async function getMessageReactions(channelId: string, messageId: string, emoji: string, options?: { limit?: number; after?: string }): Promise<DiscordReactor[]> {
  const limit = options?.limit ?? REACTION_USERS_PAGE_LIMIT
  const params = new URLSearchParams({ limit: String(limit) })
  if (options?.after) {
    params.set("after", options.after)
  }
  const url = `${DISCORD_API_BASE_URL}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}?${params.toString()}`

  return retryAfterRateLimit(async () => {
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
  })
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
 * 特定のリアクションをつけたユーザーを「全件」取得する。
 * Discord は 1 リクエスト最大 100 件なので、100 件ちょうどなら ?after= で次ページを辿り、
 * 100 件未満が返った時点を終端とみなす。取りこぼし（抽選母集団の欠落・メンション漏れ）を防ぐため打ち切らない。
 * ページ間には addReactions と同じ既定 intervalMs だけ sleep して 429 を避ける（最終ページ後は待たない）。
 * @param channelId - チャンネルID
 * @param messageId - メッセージID
 * @param emoji - 絵文字
 * @param options.intervalMs - ページ間の待機時間（ミリ秒、既定 300 = addReactions と同値）
 * @returns リアクションをつけたユーザーの配列（全件）
 */
export async function getReactionUsers(channelId: string, messageId: string, emoji: string, options?: { intervalMs?: number }): Promise<DiscordReactor[]> {
  const intervalMs = options?.intervalMs ?? 300
  const allUsers: DiscordReactor[] = []
  let after: string | undefined = undefined

  while (true) {
    const page = await getMessageReactions(channelId, messageId, emoji, { limit: REACTION_USERS_PAGE_LIMIT, after })
    allUsers.push(...page)

    // 100 件未満が返ったら終端（次ページは存在しない）
    if (page.length < REACTION_USERS_PAGE_LIMIT) {
      break
    }

    // 次ページの起点は今ページ末尾ユーザーの id
    after = page[page.length - 1].id
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  return allUsers
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
 * @param embeds - Embed 配列（mentionReactors の結果差し替え等。content を空にして embed のみ送る用途を含む）
 * @param allowedMentions - メンション解釈の制御（例: `{ parse: [] }` で @everyone 等のピングを全抑止）
 */
export async function editWebhookOriginalMessage(
  applicationId: string,
  token: string,
  content: string,
  components?: APIActionRowComponent<APIComponentInMessageActionRow>[],
  embeds?: APIEmbed[],
  allowedMentions?: APIAllowedMentions,
): Promise<void> {
  const url = `${DISCORD_API_BASE_URL}/webhooks/${applicationId}/${token}/messages/@original`

  const body: DiscordMessageBody = { content }
  if (components && components.length > 0) {
    body.components = components
  }
  if (embeds && embeds.length > 0) {
    body.embeds = embeds
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
 * メッセージの全リアクション種について、種ごとに全ユーザーを「逐次」取得して field 化する。
 * 並列（Promise.all）はリアクション系ルートで 429 を構造的に誘発する（addReactions のコメント実測値参照）ため、
 * 絵文字ごとに直列で getReactionUsers（全ページ取得）を呼び、絵文字間に intervalMs だけ sleep する。
 * @param channelId - チャンネルID
 * @param messageId - メッセージID
 * @param reactions - リアクション配列
 * @param options.intervalMs - 絵文字間の待機時間（ミリ秒、既定 300 = addReactions と同値）
 * @returns リアクションフィールドデータの配列
 */
export async function getAllReactionFields(
  channelId: string,
  messageId: string,
  reactions: DiscordReaction[],
  options?: { intervalMs?: number },
): Promise<Array<{ emojiName: string; count: number; userIds: string[] }>> {
  const intervalMs = options?.intervalMs ?? 300
  const fields: Array<{ emojiName: string; count: number; userIds: string[] }> = []

  for (let i = 0; i < reactions.length; i++) {
    const reaction = reactions[i]
    const emojiEncoded = encodeEmoji(reaction)
    const users = await getReactionUsers(channelId, messageId, emojiEncoded, { intervalMs })

    fields.push({
      emojiName: reaction.emoji.name || "?",
      count: reaction.count,
      userIds: users.map((user) => user.id),
    })

    // 次の絵文字取得までの間隔（最後の絵文字後は待たない）
    if (i < reactions.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }

  return fields
}
