import { NextRequest, NextResponse } from "next/server"
import {
  validateKey,
  validateValue,
  handleCreate,
} from "../../_handlers/redisOperations"
import { validateSession } from "@/app/libs/session"

export async function POST(req: NextRequest) {
  try {
    // セッション認証
    const authHeader = req.headers.get("authorization")

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7) // "Bearer " を削除
    const isValid = await validateSession(token)

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired session" },
        { status: 401 }
      )
    }

    // リクエストボディを取得
    const body = await req.json()
    const { key, value } = body

    // バリデーション
    const keyValidation = validateKey(key)
    if (!keyValidation.valid) {
      return NextResponse.json(
        { success: false, error: keyValidation.error },
        { status: 400 }
      )
    }

    const valueValidation = validateValue(value)
    if (!valueValidation.valid) {
      return NextResponse.json(
        { success: false, error: valueValidation.error },
        { status: 400 }
      )
    }

    // ハンドラーを呼び出す
    return await handleCreate(key, value)
  } catch (error) {
    console.error("Error in create endpoint:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
