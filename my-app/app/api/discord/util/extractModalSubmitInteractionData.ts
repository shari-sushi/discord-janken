import { APIModalSubmitInteraction, APIModalSubmission, APIModalSubmissionComponent } from "discord-api-types/v10"

/**
 * Extracted Interaction Data
 */
interface InteractionDataExtracted {
  channelId?: string
  guildId?: string
  customId?: string
  userId?: string
  components: APIModalSubmissionComponent[]
  data: APIModalSubmission | undefined
}

/**
 * Interactionからcustom_idとcomponentsを抽出する
 * @param interaction - Discord Interaction オブジェクト
 * @returns 抽出されたデータ（customId と components）
 */
export function extractModalSubmitInteractionData(interaction: APIModalSubmitInteraction): InteractionDataExtracted {
  return {
    channelId: interaction.channel?.id,
    guildId: interaction.guild_id,
    userId: interaction.member?.user?.id,
    customId: interaction.data?.custom_id,
    components: interaction.data?.components ?? [],
    data: interaction.data,
  }
}
