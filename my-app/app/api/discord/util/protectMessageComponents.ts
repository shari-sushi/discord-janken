import { CLIENT_ACTIONS } from "@/app/util/commands"
import { MessageComponent, MessageComponentTypes, ButtonStyleTypes } from "discord-interactions"

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
          custom_id: CLIENT_ACTIONS.LOL.OPEN_MODAL_BLUE_TEAM_REGISTER + `?match_id=${matchId}`,
          disabled: isDisabledTeamButtons,
        },
        {
          type: MessageComponentTypes.BUTTON,
          style: ButtonStyleTypes.DANGER,
          label: "レッドサイド",
          custom_id: CLIENT_ACTIONS.LOL.OPEN_MODAL_RED_TEAM_REGISTER + `?match_id=${matchId}`,
          disabled: isDisabledTeamButtons,
        },
        {
          type: MessageComponentTypes.BUTTON,
          style: ButtonStyleTypes.SECONDARY,
          label: "確認",
          custom_id: CLIENT_ACTIONS.LOL.CHECK_REGISTERED + `?match_id=${matchId}`,
        },
        {
          type: MessageComponentTypes.BUTTON,
          style: ButtonStyleTypes.SECONDARY,
          label: "リセット",
          custom_id: CLIENT_ACTIONS.LOL.RESET_REGISTERED + `?match_id=${matchId}`,
        },
        {
          type: MessageComponentTypes.BUTTON,
          style: ButtonStyleTypes.SECONDARY,
          label: "タイマーセット",
          custom_id: CLIENT_ACTIONS.LOL.OPEN_MODAL_TIMER + `?match_id=${matchId}`,
        },
      ],
    },
  ]
}
