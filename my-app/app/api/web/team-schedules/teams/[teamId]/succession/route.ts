import { and, eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_server/lib/db"
import { teamMembers } from "@/app/_domains/teamSchedules/_server/schema"
import { getSessionUserId, getTeamRole } from "@/app/_domains/teamSchedules/_server/authz"
import { isUuid } from "@/app/_domains/teamSchedules/_server/validators"

type RouteContext = { params: Promise<{ teamId: string }> }

/**
 * POST /api/web/team-schedules/teams/[teamId]/succession
 * チームの master を別メンバーへ継承（移譲）する（要ログイン + 現 master のみ）。王位継承のイメージ。
 * body: { userId: string }  ＝ 新しく master にするメンバーの userId（継承先）
 *
 * 認可は「認証 → メンバーシップ → master」の順:
 * - 非UUID teamId / 非メンバー: 存在を隠して 404
 * - メンバーだが master 未満（admin / member）: ロール不足で 400（PATCH / team-status に揃える）
 * 入力・継承先の検証:
 * - body.userId が非UUID / 欠落: 400
 * - 継承先が自分自身（既に master）: 400（無意味な移譲を弾く）
 * - 継承先がこのチームのメンバーでない: 400（所属していること必須）
 *
 * 反映: 現 master を admin に降格 → 継承先を master に昇格、の順で行う。
 * master はチームに高々1人（部分ユニークインデックス uq_team_members_one_master）のため、
 * 先に昇格すると一意制約に当たる。必ず降格を先に実行する。
 * トランザクションは使わない（neon-http はインタラクティブ tx 非対応・コード全体でも未使用）。
 * 降格と昇格は別 HTTP リクエストになるため、降格成功後に昇格が
 * (a) 0 行（検証後に継承先が脱退等）／(b) 例外（neon-http の通信失敗等）
 * のいずれで失敗しても、降格した自分を master に戻して master 不在を防ぐ（補償）。
 * 補償をしないと master 不在チームが残り、継承も解散も master 必須のため UI からは復旧不能になる。
 * 降格〜昇格の極小区間で master 0人になり得るが、
 * ユニークインデックスは「高々1人」の制約で 0 人は許容されるため不変条件は壊れない。
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
    if (role === null) {
      // 非メンバー（または削除済みチーム）は存在を隠して 404
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }
    if (role !== "master") {
      // 継承は現 master 専用。admin / member はロール不足（PATCH / team-status に揃えて 400）
      return NextResponse.json({ success: false, error: "管理者（master）を継承する権限がありません（現在の管理者（master）のみ可能です）" }, { status: 400 })
    }

    const body = (await req.json().catch(() => null)) as { userId?: unknown } | null
    const heirUserId = body?.userId
    if (typeof heirUserId !== "string" || !isUuid(heirUserId)) {
      return NextResponse.json({ success: false, error: "入力が不正です" }, { status: 400 })
    }
    if (heirUserId === userId) {
      // 自分自身への継承は無意味（既に master）
      return NextResponse.json({ success: false, error: "すでにあなたが管理者（master）です" }, { status: 400 })
    }

    // 継承先がこのチームのメンバーであること（所属必須）
    const heirRole = await getTeamRole(teamId, heirUserId)
    if (heirRole === null) {
      return NextResponse.json({ success: false, error: "指定したユーザーはこのチームのメンバーではありません" }, { status: 400 })
    }

    // 降格した自分を master に戻す補償。昇格が 0 行／例外のどちらで失敗しても master 不在を防ぐために呼ぶ
    const restoreSelfAsMaster = () =>
      db.update(teamMembers).set({ teamRole: "master" }).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))

    // 現 master（自分）を admin に降格してから、継承先を master に昇格する（一意制約のため順序固定）
    await db.update(teamMembers).set({ teamRole: "admin" }).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))

    let promoted: { userId: string }[]
    try {
      promoted = await db
        .update(teamMembers)
        .set({ teamRole: "master" })
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, heirUserId)))
        .returning({ userId: teamMembers.userId })
    } catch (promoteError) {
      // 昇格の通信失敗等。降格済みの自分を master に戻してから再 throw し、master 不在チームを残さない
      await restoreSelfAsMaster()
      throw promoteError
    }

    if (promoted.length === 0) {
      // 検証後に継承先が脱退した等で昇格できなかった場合、降格した自分を master に戻して master 不在を防ぐ
      await restoreSelfAsMaster()
      return NextResponse.json({ success: false, error: "指定したユーザーはこのチームのメンバーではありません" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("team-schedules succession POST error:", error)
    return NextResponse.json({ success: false, error: "管理者（master）の継承に失敗しました" }, { status: 500 })
  }
}
