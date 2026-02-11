import { CLIENT_ACTIONS } from "./commands"

/**
 * プロテクト機能用のボタンコンポーネントを生成
 * @param matchId - 試合ID
 * @returns Discordコンポーネント配列
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createProtectComponents(matchId: string): any[] {
  return [
    {
      type: 1, // Action Row
      components: [
        {
          type: 2, // Button
          style: 1, // Primary (青)
          label: "青チーム",
          custom_id: CLIENT_ACTIONS.OPEN_MODAL_BLUE_TEAM_REGISTER + `?match_id=${matchId}`,
        },
        {
          type: 2, // Button
          style: 4, // Danger (赤)
          label: "赤チーム",
          custom_id: CLIENT_ACTIONS.OPEN_MODAL_RED_TEAM_REGISTER + `?match_id=${matchId}`,
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
