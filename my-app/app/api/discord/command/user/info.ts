import { InteractionResponseFlags, InteractionResponseType } from "discord-interactions"
import { NextResponse } from "next/server"

export const userInfoCommand = (): NextResponse => {
    // discordにコマンドを登録するために中身はいったん後で実装する
    return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: "開発中です",
        },
        flags: InteractionResponseFlags.EPHEMERAL
    })
}