import { CLIENT_ACTIONS } from "@/app/_server/util/commands"
import { MessageComponent, MessageComponentTypes, ButtonStyleTypes } from "discord-interactions"
import { customId } from "./customId"

/**
 * プロテクト機能用のボタンコンポーネントを生成
 * @param matchId - 試合ID
 * @param isDisabledTeamButtons - ブルーサイド・レッドサイドボタンをdisabledにするか
 * @returns Discordコンポーネント配列
 */
export function createProtectComponents(matchId: string, isDisabledTeamButtons = false): MessageComponent[] {
  return [
    {
      type: MessageComponentTypes.ACTION_ROW,
      components: [
        {
          type: MessageComponentTypes.BUTTON,
          style: ButtonStyleTypes.PRIMARY,
          label: "ブルーサイド",
          custom_id: customId(CLIENT_ACTIONS.LOL.OPEN_MODAL_BLUE_TEAM_REGISTER).matchId(matchId),
          disabled: isDisabledTeamButtons,
        },
        {
          type: MessageComponentTypes.BUTTON,
          style: ButtonStyleTypes.DANGER,
          label: "レッドサイド",
          custom_id: customId(CLIENT_ACTIONS.LOL.OPEN_MODAL_RED_TEAM_REGISTER).matchId(matchId),
          disabled: isDisabledTeamButtons,
        },
        {
          type: MessageComponentTypes.BUTTON,
          style: ButtonStyleTypes.SECONDARY,
          label: "確認",
          custom_id: customId(CLIENT_ACTIONS.LOL.CHECK_REGISTERED).matchId(matchId),
        },
        {
          type: MessageComponentTypes.BUTTON,
          style: ButtonStyleTypes.SECONDARY,
          label: "リセット",
          custom_id: customId(CLIENT_ACTIONS.LOL.RESET_REGISTERED).matchId(matchId),
        },
        {
          type: MessageComponentTypes.BUTTON,
          style: ButtonStyleTypes.SECONDARY,
          label: "タイマーセット",
          custom_id: customId(CLIENT_ACTIONS.LOL.OPEN_MODAL_TIMER).matchId(matchId),
        },
      ],
    },
  ]
}
