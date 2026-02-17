import { MessageComponent } from "discord-interactions"
import { CLIENT_ACTIONS } from "./commands"

/**
 * プロテクト機能用のボタンコンポーネントを生成
 * @param matchId - 試合ID
 * @param isDisabledTeamButtons - ブルーサイド・レッドサイドボタンをdisabledにするか
 * @returns Discordコンポーネント配列
 */
export function createProtectComponents(matchId: string, isDisabledTeamButtons = false): MessageComponent[] {
  return [
    {
      type: 1, // Action Row
      components: [
        {
          type: 2, // Button
          style: 1, // Primary (青)
          label: "ブルーサイド",
          custom_id: CLIENT_ACTIONS.OPEN_MODAL_BLUE_TEAM_REGISTER + `?match_id=${matchId}`,
          disabled: isDisabledTeamButtons,
        },
        {
          type: 2, // Button
          style: 4, // Danger (赤)
          label: "レッドサイド",
          custom_id: CLIENT_ACTIONS.OPEN_MODAL_RED_TEAM_REGISTER + `?match_id=${matchId}`,
          disabled: isDisabledTeamButtons,
        },
        {
          type: 2, // Button
          style: 2, // Secondary (グレー)
          label: "確認",
          custom_id: CLIENT_ACTIONS.CHECK_REGISTERED + `?match_id=${matchId}`,
        },
        {
          type: 2, // Button
          style: 2, // Secondary (グレー)
          label: "タイマーセット",
          custom_id: CLIENT_ACTIONS.OPEN_MODAL_TIMER + `?match_id=${matchId}`,
        },
      ],
    },
  ]
}
