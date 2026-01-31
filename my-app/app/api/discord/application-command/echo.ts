import { NextResponse } from "next/server"

type Arg = {
  name: string
  value: string
}

export const echoCommand = (options: Arg[]) => {
  const text = options?.find((opt: Arg) => opt.name === "text")?.value || ""

  return NextResponse.json({
    type: 4, // メッセージとして投稿させる
    data: {
      content: text,
    },
  })
}
