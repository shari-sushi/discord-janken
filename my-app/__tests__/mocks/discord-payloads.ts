import { InteractionType } from "discord-interactions"
import { COMMANDS, CLIENT_ACTIONS } from "@/app/_server/util/commands"
import { customId } from "@/app/api/discord/util/customId"

/**
 * 基本的なDiscordユーザー情報
 */
const mockUser = {
  id: "123456789012345678",
  username: "test_user",
  discriminator: "0",
  avatar: "test-avatar-hash",
}

/**
 * 基本的なDiscordメンバー情報
 */
const mockMember = {
  user: mockUser,
  roles: ["987654321098765432"],
  nick: "TestNick",
}

/**
 * PING インタラクション
 */
export const createPingPayload = () => ({
  type: InteractionType.PING,
})

/**
 * APPLICATION_COMMAND インタラクション（コマンド実行）
 */
const createCommandPayload = (commandName: string, options: Array<{ name: string; value: string | number }> = []) => ({
  type: InteractionType.APPLICATION_COMMAND,
  id: "interaction-id-" + Math.random().toString(36).substring(7),
  application_id: "test-app-id",
  token: "test-interaction-token",
  version: 1,
  data: {
    name: commandName,
    options,
  },
  guild_id: "test-guild-id",
  channel_id: "test-channel-id",
  member: mockMember,
})

/**
 * /lol-new-match コマンド
 */
export const createNewMatchCommandPayload = () => createCommandPayload(COMMANDS.LOL.NEW_MATCH)

/**
 * /dev-echo コマンド
 */
export const createEchoCommandPayload = (text: string) => createCommandPayload(COMMANDS.DEV.ECHO, [{ name: "text", value: text }])

/**
 * /dev-test コマンド
 */
export const createDevelopersTestCommandPayload = (testNumber: number = 1) => createCommandPayload(COMMANDS.DEV.TEST, [{ name: "number", value: testNumber }])

/**
 * MESSAGE_COMPONENT インタラクション（ボタンクリック）
 */
export const createButtonClickPayload = (customId: string, messageId: string = "test-message-id") => ({
  type: InteractionType.MESSAGE_COMPONENT,
  id: "interaction-id-" + Math.random().toString(36).substring(7),
  application_id: "test-app-id",
  token: "test-interaction-token",
  version: 1,
  data: {
    custom_id: customId,
    component_type: 2, // Button
  },
  guild_id: "test-guild-id",
  channel_id: "test-channel-id",
  member: mockMember,
  message: {
    id: messageId,
    content: "Test message",
  },
})

/**
 * MESSAGE_COMPONENT インタラクション（セレクトメニュー）
 */
export const createSelectMenuPayload = (customId: string, values: string[]) => ({
  type: InteractionType.MESSAGE_COMPONENT,
  id: "interaction-id-" + Math.random().toString(36).substring(7),
  application_id: "test-app-id",
  token: "test-interaction-token",
  version: 1,
  data: {
    custom_id: customId,
    component_type: 3, // Select Menu
    values,
  },
  guild_id: "test-guild-id",
  channel_id: "test-channel-id",
  member: mockMember,
})

/**
 * MODAL_SUBMIT インタラクション（モーダル送信）
 */
export const createModalSubmitPayload = (customId: string, components: { customId: string; value: string }[]) => ({
  type: InteractionType.MODAL_SUBMIT,
  id: "interaction-id-" + Math.random().toString(36).substring(7),
  application_id: "test-app-id",
  token: "test-interaction-token",
  version: 1,
  data: {
    custom_id: customId,
    components: components.map((comp) => ({
      type: 1, // Action Row
      components: [
        {
          type: 4, // Text Input
          custom_id: comp.customId,
          value: comp.value,
        },
      ],
    })),
  },
  guild_id: "test-guild-id",
  channel_id: "test-channel-id",
  member: mockMember,
})
