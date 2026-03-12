/**
 * Discord API の型定義
 * discord-interactions ライブラリに含まれていない型を定義
 * → discord-api-types に移行中
 */

// https://docs.discord.com/developers/resources/message#embed-object
export interface DiscordEmbed {
  title?: string
  description?: string
  fields?: DiscordEmbedField[]
  footer?: {
    text: string
    icon_url?: string
    proxy_icon_url?: string
  }
  timestamp?: {
    text: string // footer text
    icon_url?: string // url of footer icon (only supports http(s) and attachments)
    proxy_icon_url?: string // a proxied url of footer icon
  }
  author?: {
    name: string // name of author
    url?: string // url of author (only supports http(s))
    icon_url?: string // url of author icon (only supports http(s) and attachments)
    proxy_icon_url?: string // a proxied url of author icon
  }
  color?: number
}

export interface DiscordEmbedField {
  name: string
  value: string
  inline?: boolean
}
