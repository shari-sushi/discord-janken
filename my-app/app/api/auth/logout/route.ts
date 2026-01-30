import { NextRequest, NextResponse } from "next/server"
import { deleteSession } from "@/app/libs/session"

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "No session token provided" },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7) // "Bearer " を削除

    const deleted = await deleteSession(token)

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Logged out successfully",
    })
  } catch (error) {
    console.error("Error in logout:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
