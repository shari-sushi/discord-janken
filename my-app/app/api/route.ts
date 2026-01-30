import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message } = body

    // 受け取ったメッセージをそのまま返す
    return NextResponse.json({ message })
  } catch (error) {
    return NextResponse.json({ message: "エラーが発生しました" }, { status: 400 })
  }
}