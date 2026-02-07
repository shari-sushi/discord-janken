import { CLIENT_ACTIONS } from "@/app/util/commands"
import { NextResponse } from "next/server"
import { SelectOptionStructure } from "../types"

export const feedbackCommand = () => {
  return NextResponse.json({
    type: 4, // メッセージを返す
    data: {
      content: "フィードバックの種類を選択してください",
      components: [
        {
          type: 1, // Action Row
          components: [
            {
              type: 3, // String Select Menu
              custom_id: CLIENT_ACTIONS.SELECT_FEEDBACK_TYPE,
              placeholder: "種類を選択...",
              options: [
                {
                  label: "不具合",
                  value: "bugs",
                },
                {
                  label: "意見・要望",
                  value: "opinion",
                },
                {
                  label: "操作ミスの体験",
                  value: "miss operation",
                },
                {
                  label: "その他",
                  value: "other",
                },
              ] satisfies SelectOptionStructure[],
            },
          ],
        },
      ],
      flags: 64, // EPHEMERAL - 送信者のみに表示
    },
  })
}
