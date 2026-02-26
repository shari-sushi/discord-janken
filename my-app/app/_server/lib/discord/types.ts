/**
 * Discord API の型定義
 * discord-interactions ライブラリに含まれていない型を定義
 */

/**
 * Application Command Option Type
 * @see {@link https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-type}
 */
export enum ApplicationCommandOptionType {
  SUB_COMMAND = 1,
  SUB_COMMAND_GROUP = 2,
  STRING = 3,
  INTEGER = 4,
  BOOLEAN = 5,
  USER = 6,
  CHANNEL = 7,
  ROLE = 8,
  MENTIONABLE = 9,
  NUMBER = 10,
  ATTACHMENT = 11,
}

/**
 * Message Component Data (Interaction.data.components)
 */
export interface MessageComponentData {
  custom_id?: string
  type?: number
  id?: number
  components?: MessageComponentData[] // Type 1 (Text Input) uses this
  component?: MessageComponentData // Type 18 (Select Menu in Modal) uses this
  value?: string
  values?: string[]
}

/**
 * Interaction Data
 */
export interface InteractionData {
  custom_id?: string
  components?: MessageComponentData[]
  values?: string[]
}

/**
 * Interaction Object
 */
export interface DiscordInteraction {
  id: string
  application_id: string
  type: number
  data?: InteractionData
  guild_id?: string
  channel_id?: string
  member?: {
    user?: {
      id: string
      username: string
    }
  }
  user?: {
    id: string
    username: string
  }
  token: string
  version: number
  message?: {
    id: string
    channel_id: string
    author: {
      id: string
      username: string
      discriminator: string
      avatar: string | null
      bot?: boolean
    }
    content: string
    timestamp: string
    edited_timestamp: string | null
    flags: number
    components?: unknown[]
    embeds?: unknown[]
  }
}

