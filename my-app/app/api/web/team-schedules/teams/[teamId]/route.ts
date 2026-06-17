import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_server/lib/db"
import { teams } from "@/app/_domains/teamSchedules/_server/schema"
import { getSessionUserId, getTeamRole } from "@/app/_domains/teamSchedules/_server/authz"
import { hasAdminAuthority } from "@/app/_domains/teamSchedules/types"
import { isManagementMode, isUuid } from "@/app/_domains/teamSchedules/_server/validators"
import type { TeamSummary } from "@/app/_domains/teamSchedules/types"

type RouteContext = { params: Promise<{ teamId: string }> }

/** 認可に失敗したら返すべきレスポンス、成功なら ok を返す */
type AuthzResult = { ok: true } | { ok: false; res: NextResponse }

/**
 * チーム情報を編集できるかを「認証 → メンバーシップ → ロール」の順に判定する。
 * 入力検証より前に呼ぶこと（権限の無い相手の body は処理しない）。team-status と同じ流儀:
 * - 非UUID / 非メンバー: 存在を隠して 404
 * - メンバーだが admin 相当未満（member）: 権限不足で 400
 *   （リソース内ロール不足は team-status/route.ts に揃えて 400。作成権限不足の POST /teams の 403 とは別軸）
 */
async function authorizeTeamAdmin(req: NextRequest, teamId: string): Promise<AuthzResult> {
  if (!isUuid(teamId)) {
    return { ok: false, res: NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 }) }
  }

  const userId = await getSessionUserId(req)
  if (!userId) {
    return { ok: false, res: NextResponse.json({ success: false, error: "ログインが必要です" }, { status: 401 }) }
  }

  const role = await getTeamRole(teamId, userId)
  if (role === null) {
    return { ok: false, res: NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 }) }
  }
  if (!hasAdminAuthority(role)) {
    return { ok: false, res: NextResponse.json({ success: false, error: "チームを編集する権限がありません" }, { status: 400 }) }
  }

  return { ok: true }
}

/**
 * PATCH /api/web/team-schedules/teams/[teamId]
 * チーム情報を部分更新する（要ログイン + admin相当）。各フィールドはオプショナルで冪等:
 * undefined は編集しない / 値があれば上書きする。body: { name?, description?, requiredCount?, managementMode? }
 *
 * #126 第1弾のスコープ: 反映するのは managementMode のみ。name / description / requiredCount は
 * Issue の指示「それ以外は受け取った後無視」に従い、受け取っても DB へは適用しない（バリデーションもしない）。
 *
 * 冪等性の都合上、空ボディ・不正JSON（req.json() が null）・無視されるフィールドのみのボディは
 * いずれも「適用対象なしの no-op」として現在のチーム情報を 200 で返す（team-status と違い 400 にはしない）。
 * managementMode に不正値が入っている場合だけ 400 で弾く。
 */
export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    const { teamId } = await ctx.params

    const authz = await authorizeTeamAdmin(req, teamId)
    if (!authz.ok) return authz.res

    const body = (await req.json().catch(() => null)) as { managementMode?: unknown } | null
    // managementMode が来ている場合のみ検証して適用する（不正値は弾く）
    if (body && body.managementMode !== undefined) {
      if (!isManagementMode(body.managementMode)) {
        return NextResponse.json({ success: false, error: "入力が不正です" }, { status: 400 })
      }
      await db.update(teams).set({ managementMode: body.managementMode }).where(eq(teams.teamId, teamId))
    }
    // managementMode が無ければ DB 更新せず、現在値をそのまま返す（冪等な no-op）

    const rows = await db
      .select({
        teamId: teams.teamId,
        name: teams.name,
        description: teams.description,
        requiredCount: teams.requiredCount,
        managementMode: teams.managementMode,
      })
      .from(teams)
      .where(eq(teams.teamId, teamId))
      .limit(1)

    const team = rows[0]
    if (!team) {
      // 認可を通った直後の消失（削除レース等）。存在隠匿の流儀で 404
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }

    const result: TeamSummary = team
    return NextResponse.json({ success: true, team: result })
  } catch (error) {
    console.error("team-schedules teams PATCH error:", error)
    return NextResponse.json({ success: false, error: "チームの更新に失敗しました" }, { status: 500 })
  }
}
