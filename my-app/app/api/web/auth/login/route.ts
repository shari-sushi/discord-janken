import { NextRequest, NextResponse } from "next/server"
import { createSession } from "@/app/_server/lib/session"
import { ALLOWED_USERS } from "@/app/_server/lib/env"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json({ success: false, error: "Username and password are required" }, { status: 400 })
    }

    // ALLOWED_USERS をパース: "user1:pass1,user2:pass2" の形式
    const users = ALLOWED_USERS.split(",").map((entry) => {
      const [u, p] = entry.split(":")
      return { username: u.trim(), password: p.trim() }
    })

    // ユーザー名とパスワードを検証
    const user = users.find((u) => u.username === username && u.password === password)
    if (!user) {
      return NextResponse.json({ success: false, error: "Invalid username or password" }, { status: 401 })
    }

    // セッションを作成
    const sessionToken = await createSession(username)

    return NextResponse.json({
      success: true,
      token: sessionToken,
    })
  } catch (error) {
    console.error("Error in login:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
