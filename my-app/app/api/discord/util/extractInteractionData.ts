import { DiscordInteraction, InteractionData, MessageComponentData } from "@/app/_server/lib/discord/types"

/**
 * Extracted Interaction Data
 */
interface InteractionDataExtracted {
  channelId?: string
  guildId?: string
  customId?: string
  userId?: string
  components: MessageComponentData[]
  data: InteractionData | undefined
}

/**
 * Interactionからcustom_idとcomponentsを抽出する
 * @param interaction - Discord Interaction オブジェクト
 * @returns 抽出されたデータ（customId と components）
 */
export function extractInteractionData(interaction: DiscordInteraction): InteractionDataExtracted {
  return {
    channelId: interaction.channel_id,
    guildId: interaction.guild_id,
    userId: interaction.member?.user?.id,
    customId: interaction.data?.custom_id,
    components: interaction.data?.components ?? [],
    data: interaction.data,
  }
}
