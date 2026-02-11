/**
 * Discord REST API 通信用のヘルパー関数
 */

const DISCORD_API_BASE_URL = "https://discord.com/api/v10"
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!

export interface DiscordMessageResponse {
  id: string
  channel_id: string
  content: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export class DiscordApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public details?: any,
  ) {
    super(`Discord API Error: ${status} ${statusText}`)
    this.name = "DiscordApiError"
  }
}

/**
 * Discordチャンネルにメッセージを送信する
 * @param channelId - 送信先のチャンネルID
 * @param content - メッセージ本文
 * @param components - ボタンなどのコンポーネント配列
 * @returns Discord APIからのレスポンス（message_id等）
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendDiscordMessage(channelId: string, content: string, components?: any[]): Promise<DiscordMessageResponse> {
  const url = `${DISCORD_API_BASE_URL}/channels/${channelId}/messages`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = {
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
