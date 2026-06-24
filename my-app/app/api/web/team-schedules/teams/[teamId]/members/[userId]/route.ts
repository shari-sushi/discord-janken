import { and, eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_server/lib/db"
import { teamMembers } from "@/app/_domains/teamSchedules/_server/schema"
import { getSessionUserId, getTeamMembershipWithSuspension } from "@/app/_domains/teamSchedules/_server/authz"
import { hasAdminAuthority } from "@/app/_domains/teamSchedules/types"
import { isUuid } from "@/app/_domains/teamSchedules/_server/validators"

type RouteContext = { params: Promise<{ teamId: string; userId: string }> }

/**
 * DELETE /api/web/team-schedules/teams/[teamId]/members/[userId]
 * チーム管理者（master / admin）による強制脱退（kick）。#97。
 *
 * サイト管理者用の admin/.../members/[userId]（requireAdmin）とは別物で、こちらは「そのチームの admin 相当」が叩く。
 * team_members 行を1件削除し、複合FK の cascade でそのチーム内のそのユーザーの schedules も自動で消える。
 *
 * ガード（UI でも×ボタンを出し分けるが、サーバーでも必ず判定する二重防御）:
 * - 非UUID(teamId) / 未ログイン / 呼び出し元が admin 相当未満（非メンバー・member）: 存在を隠して 404
 * - 呼び出し元が利用停止中（suspended）: 403。kick は「他人を消す管理書き込み」なので、自己片付け
 *   （脱退・アカウント削除＝suspend 中でも許可）とは異なり、succession / team-status と同じく止める（#166）。
 * - 対象が master: 除外不可（master 保護・400）
 * - 対象が自分自身: 除外不可（脱退は設定の「チームを脱退」を使う・400）
 */
export async function DELETE(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    const { teamId, userId } = await ctx.params

    // 呼び出し元が「このチームの admin 相当以上」でなければ、チームの存在ごと隠して 404
    if (!isUuid(teamId)) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }
    const callerId = await getSessionUserId(req)
    if (!callerId) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }
    // 操作者の利用停止判定とロール取得を1クエリにまとめる（#166・DB往復削減）。suspend→403 を先に判定する
    // （succession / team-status と同じ流儀。suspended は users 起点で非メンバーでも取れる）
    const { suspended, teamRole: callerRole } = await getTeamMembershipWithSuspension(teamId, callerId)
    if (suspended) {
      return NextResponse.json({ success: false, error: "アカウントが利用停止中のため、この操作はできません" }, { status: 403 })
    }
    if (callerRole === null || !hasAdminAuthority(callerRole)) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }

    // ここから先は admin 相当が確定。対象 ID の形式不正は通常のバリデーションエラー（400）
    if (!isUuid(userId)) {
      return NextResponse.json({ success: false, error: "IDが不正です" }, { status: 400 })
    }
    // 自分自身は kick 不可（自分が抜けるときは設定の「チームを脱退」を使う）
    if (userId === callerId) {
      return NextResponse.json({ success: false, error: "自分自身は脱退させられません。設定の「チームを脱退」をご利用ください。" }, { status: 400 })
    }

    const rows = await db
      .select({ teamRole: teamMembers.teamRole })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
      .limit(1)
    const target = rows[0]
    if (!target) {
      return NextResponse.json({ success: false, error: "対象のメンバーが見つかりません" }, { status: 404 })
    }
    // master は保護（admin/.../members の一律ルールと同じ）。master を外したいときは先に master を移譲する
    if (target.teamRole === "master") {
      return NextResponse.json(
        { success: false, error: "管理者（master）は脱退させられません。先に master を別メンバーへ移譲してください。" },
        { status: 400 },
      )
    }

    await db.delete(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("team-schedules team member DELETE error:", error)
    return NextResponse.json({ success: false, error: "メンバーの脱退に失敗しました" }, { status: 500 })
  }
}
