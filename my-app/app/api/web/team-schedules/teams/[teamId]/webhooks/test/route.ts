import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId, getTeamRole } from "@/app/_domains/teamSchedules/_server/authz"
import { hasAdminAuthority, type WebhookProvider } from "@/app/_domains/teamSchedules/types"
import { isDiscordWebhookUrl, isUuid, isWebhookProvider } from "@/app/_domains/teamSchedules/_server/validators"
import { sendWebhookTest } from "@/app/_domains/teamSchedules/_server/notify"

type RouteContext = { params: Promise<{ teamId: string }> }

/**
 * POST /api/web/team-schedules/teams/[teamId]/webhooks/test
 * 入力中の Webhook URL へテスト通知を送る（admin 相当以上）。body: { provider?, webhookUrl }
 *
 * 「保存前にテスト送信を成功させる」UI のためのエンドポイント。DB は触らず、与えられた URL に直接送る。
 * 認可は webhooks/route.ts と同じ流儀（非UUID/非メンバー/member は存在隠匿で 404）。
 */
export async function POST(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    const { teamId } = await ctx.params
    if (!isUuid(teamId)) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }
    const userId = await getSessionUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, error: "ログインが必要です" }, { status: 401 })
    }
    const role = await getTeamRole(teamId, userId)
    if (role === null || !hasAdminAuthority(role)) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }

    const body = (await req.json().catch(() => null)) as { provider?: unknown; webhookUrl?: unknown } | null
    // provider 省略時は discord。指定があれば対応済みかを検証する
    if (body?.provider !== undefined && !isWebhookProvider(body.provider)) {
      return NextResponse.json({ success: false, error: "入力が不正です" }, { status: 400 })
    }
    const provider: WebhookProvider = body?.provider ?? "discord"
    if (!isDiscordWebhookUrl(body?.webhookUrl)) {
      return NextResponse.json({ success: false, error: "入力が不正です" }, { status: 400 })
    }

    try {
      await sendWebhookTest(provider, body.webhookUrl)
    } catch (e) {
      console.error("team-schedules webhooks test 送信失敗:", e)
      return NextResponse.json({ success: false, error: "テスト通知の送信に失敗しました。URL を確認してください" }, { status: 502 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("team-schedules webhooks test error:", error)
    return NextResponse.json({ success: false, error: "テスト通知の送信に失敗しました" }, { status: 500 })
  }
}
