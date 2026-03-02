/**
 * Discord REST API 通信用のヘルパー関数
 */

import { MessageComponent } from "discord-interactions"
import { DISCORD_API_BASE_URL, DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID } from "@/app/_server/lib/env"

export interface DiscordMessageResponse {
  id: string
  channel_id: string
  content: string
  [key: string]: unknown
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
  components?: MessageComponent[]
}

/**
 * Discordチャンネルにメッセージを送信する
 * @param channelId - 送信先のチャンネルID
 * @param content - メッセージ本文
 * @param components - ボタンなどのコンポーネント配列
 * @returns Discord APIからのレスポンス（message_id等）
 */
export async function sendDiscordMessage(channelId: string, content: string, components?: MessageComponent[]): Promise<DiscordMessageResponse> {
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
export async function editDiscordMessage(channelId: string, messageId: string, content: string, components?: MessageComponent[]): Promise<void> {
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
