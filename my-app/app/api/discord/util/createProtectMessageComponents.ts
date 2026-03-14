import { CLIENT_ACTIONS } from "@/app/_server/util/commands"
import { customId } from "./customId"
import { APIActionRowComponent, APIComponentInMessageActionRow, ButtonStyle, ComponentType } from "discord-api-types/v10"

/**
 * プロテクト機能用のボタンコンポーネントを生成
 * @param matchId - 試合ID
 * @param disableAllButtons - 全てのボタンをdisabledにするか（両チーム登録完了時に true）
 * @returns Discordコンポーネント配列
 */
export function createProtectComponents(matchId: string, disableAllButtons = false): APIActionRowComponent<APIComponentInMessageActionRow>[] {
  return [
    {
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button,
          style: ButtonStyle.Primary,
          label: "ブルーサイド",
          custom_id: customId(CLIENT_ACTIONS.LOL.OPEN_MODAL_BLUE_TEAM_REGISTER).matchId(matchId),
          disabled: disableAllButtons,
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Danger,
          label: "レッドサイド",
          custom_id: customId(CLIENT_ACTIONS.LOL.OPEN_MODAL_RED_TEAM_REGISTER).matchId(matchId),
          disabled: disableAllButtons,
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Secondary,
          label: "確認",
          custom_id: customId(CLIENT_ACTIONS.LOL.CHECK_REGISTERED).matchId(matchId),
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Secondary,
          label: "リセット",
          custom_id: customId(CLIENT_ACTIONS.LOL.RESET_REGISTERED).matchId(matchId),
          disabled: disableAllButtons,
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Secondary,
          label: "タイマーセット",
          custom_id: customId(CLIENT_ACTIONS.LOL.OPEN_MODAL_TIMER).matchId(matchId),
          disabled: disableAllButtons,
        },
      ],
    },
  ]
}
