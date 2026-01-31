import { CLIENT_ACTIONS } from "@/app/util/commands"
import { newId } from "@/app/util/newId"
import { NextResponse } from "next/server"

export const newProtectCommand = () => {
  const matchId = newId()

  return NextResponse.json({
    type: 4,
    data: {
      content: "チームを選択してください",
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 4,
              label: "赤チーム",
              custom_id: CLIENT_ACTIONS.OPEN_MODAL_RED_TEAM_REGISTER + `?match_id=${matchId}`,
            },
            {
              type: 2,
              style: 1,
              label: "青チーム",
              custom_id: CLIENT_ACTIONS.OPEN_MODAL_BLUE_TEAM_REGISTER + `?match_id=${matchId}`,
            },
            {
              type: 2,
              style: 2,
              label: "確認",
              custom_id: CLIENT_ACTIONS.CHECK_REGISTERED + `?match_id=${matchId}`,
            },
          ],
        },
      ],
    },
  })
}
