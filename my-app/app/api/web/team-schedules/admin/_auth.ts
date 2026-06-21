import { NextRequest, NextResponse } from "next/server"
import { validateAuthHeader } from "@/app/_server/lib/auth"

/**
 * スクリム調整 管理API 共通の認証ガード（#166）。
 *
 * 開発者ログイン（`/developers/redis` と同じ流儀）を流用する。
 * Authorization ヘッダーを `validateAuthHeader`（Bearer = 開発者セッション / Basic = ALLOWED_USERS）で検証し、
 * NG なら 401 レスポンスを、OK なら null を返す（呼び出し側はそのまま処理を続ける）。
 *
 * 利用者の ts_session（Cookie）とは別系統。一般ユーザーは admin API に到達できない（権限分離）。
 *
 * 注: `_` プレフィックスのため Next.js のルーティング対象にはならない（route.ts のみが対象）。
 */
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const result = await validateAuthHeader(req.headers.get("authorization"))
  if (!result.valid) {
    return NextResponse.json({ success: false, error: result.error ?? "認証が必要です" }, { status: 401 })
  }
  return null
}
