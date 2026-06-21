import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_server/lib/db"
import { teams } from "@/app/_domains/teamSchedules/_server/schema"
import { getSessionUserId, getTeamMembershipWithSuspension } from "@/app/_domains/teamSchedules/_server/authz"
import { hasAdminAuthority } from "@/app/_domains/teamSchedules/types"
import { isManagementMode, isUuid, isValidRequiredCount, isValidTeamName } from "@/app/_domains/teamSchedules/_server/validators"
import type { TeamManagementMode, TeamSummary } from "@/app/_domains/teamSchedules/types"

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

  // 利用停止判定とロール取得を1クエリにまとめる（#166・DB往復削減）。suspend→403 を先に判定する
  const { suspended, teamRole: role } = await getTeamMembershipWithSuspension(teamId, userId)
  if (suspended) {
    return { ok: false, res: NextResponse.json({ success: false, error: "アカウントが利用停止中のため、この操作はできません" }, { status: 403 }) }
  }
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
 * 反映するのは name（#96）/ managementMode（#126）/ requiredCount（#142）。description は
 * Issue の指示「それ以外は受け取った後無視」に従い、受け取っても DB へは適用しない（バリデーションもしない）。
 *
 * 冪等性の都合上、空ボディ・不正JSON（req.json() が null）・無視されるフィールドのみのボディは
 * いずれも「適用対象なしの no-op」として現在のチーム情報を 200 で返す（team-status と違い 400 にはしない）。
 * name / managementMode / requiredCount に不正値が入っている場合だけ 400 で弾く。
 */
export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    const { teamId } = await ctx.params

    const authz = await authorizeTeamAdmin(req, teamId)
    if (!authz.ok) return authz.res

    const body = (await req.json().catch(() => null)) as { name?: unknown; managementMode?: unknown; requiredCount?: unknown } | null

    // 反映対象を1つの set オブジェクトに組み立てる。フィールドが来ている場合のみ検証して積む（不正値は弾く）。
    // description は body で受け取っても無視する（反映しない）。
    const patch: { name?: string; managementMode?: TeamManagementMode; requiredCount?: number } = {}
    if (body && body.name !== undefined) {
      if (!isValidTeamName(body.name)) {
        return NextResponse.json({ success: false, error: "入力が不正です" }, { status: 400 })
      }
      // 保存は trim 後（POST /teams と同じ流儀）
      patch.name = body.name.trim()
    }
    if (body && body.requiredCount !== undefined) {
      // 活動必要人数（1以上の整数）。members モードでのみ意味を持つが、ここではモードに依らず値だけ検証して反映する
      if (!isValidRequiredCount(body.requiredCount)) {
        return NextResponse.json({ success: false, error: "入力が不正です" }, { status: 400 })
      }
      patch.requiredCount = body.requiredCount
    }
    if (body && body.managementMode !== undefined) {
      if (!isManagementMode(body.managementMode)) {
        return NextResponse.json({ success: false, error: "入力が不正です" }, { status: 400 })
      }
      // モードを切り替えても schedules / team_day_status は触らない。反対モードの行は孤児として
      // 残るが、グリッドは現モードのデータしか描画せず、team-status の書き込みもモードで弾かれるため
      // 実害は無い（第1弾の割り切り）。クリーンアップが必要になったら別 Issue で対応する。
      patch.managementMode = body.managementMode
    }

    // 適用対象が1つ以上あるときだけ DB を更新する。無ければ更新せず現在値をそのまま返す（冪等な no-op）
    if (Object.keys(patch).length > 0) {
      await db.update(teams).set(patch).where(eq(teams.teamId, teamId))
    }

    // 更新有無に関わらず最後に1回 select してチームを返す。更新パスは .returning() で1往復に
    // 畳めるが、no-op パスでも同じ TeamSummary を返す必要があり、返却の組み立てを1箇所に
    // 揃えるためあえて別 select にしている（保存は低頻度なので往復増の影響は無視できる）。
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

    // select の列が TeamSummary と一致することのコンパイル時アサーション（POST /teams と同じ流儀）
    const result: TeamSummary = team
    return NextResponse.json({ success: true, team: result })
  } catch (error) {
    console.error("team-schedules teams PATCH error:", error)
    return NextResponse.json({ success: false, error: "チームの更新に失敗しました" }, { status: 500 })
  }
}

/**
 * DELETE /api/web/team-schedules/teams/[teamId]
 * チームを解散する（要ログイン + master のみ）。teams 行を1件削除すると FK の onDelete 連鎖で
 * 関連データがまとめて消える:
 * - team_members（teamId, onDelete: cascade）→ schedules（複合FK, onDelete: cascade）
 * - team_day_status（teamId, onDelete: cascade）
 *
 * 認可は「認証 → メンバーシップ → master」の順:
 * - 非UUID / 非メンバー: 存在を隠して 404
 * - メンバーだが master 未満（admin / member）: 権限不足で 400
 *   （リソース内ロール不足は PATCH / team-status に揃えて 400。解散はチーム全体を消す破壊的操作のため master 専用）
 *
 * 注: Redis に残る招待トークンは解散後も残るが、join 時にチーム存在を検証して弾かれるため実害は無い
 *     （account DELETE と同じ割り切り）。注: メンバー自身の脱退は membership DELETE（別操作）。
 */
export async function DELETE(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    const { teamId } = await ctx.params

    if (!isUuid(teamId)) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }

    const userId = await getSessionUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, error: "ログインが必要です" }, { status: 401 })
    }

    // 利用停止判定とロール取得を1クエリにまとめる（#166・DB往復削減）。suspend→403 を先に判定する
    const { suspended, teamRole: role } = await getTeamMembershipWithSuspension(teamId, userId)
    if (suspended) {
      return NextResponse.json({ success: false, error: "アカウントが利用停止中のため、この操作はできません" }, { status: 403 })
    }
    if (role === null) {
      // 非メンバー（または削除済みチーム）は存在を隠して 404
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }
    if (role !== "master") {
      // 解散は master 専用。admin / member はロール不足（PATCH / team-status に揃えて 400）
      return NextResponse.json({ success: false, error: "チームを解散する権限がありません（管理者（master）のみ可能です）" }, { status: 400 })
    }

    await db.delete(teams).where(eq(teams.teamId, teamId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("team-schedules teams DELETE error:", error)
    return NextResponse.json({ success: false, error: "チームの解散に失敗しました" }, { status: 500 })
  }
}
