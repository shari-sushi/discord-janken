import { desc, eq, notInArray } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_server/lib/db"
import { discordLinks, teamMembers, teams, teamShares, users } from "@/app/_domains/teamSchedules/_server/schema"
import type { AdminOrphanUser, AdminOverview, AdminShare, AdminTeam, AdminTeamMember, LolRoleFlags } from "@/app/_domains/teamSchedules/types"
import { requireAdmin } from "../_auth"

/**
 * GET /api/web/team-schedules/admin/overview
 * 全チーム＋設定＋メンバー（discordUserId, teamRole, suspended 含む）＋無所属ユーザーを返す（要 admin）。
 *
 * 管理画面のメイン取得。admin 認証済みのため Discord ID を含めてよい（利用者APIとは別方針）。
 * neon-http は逐次クエリ。件数は運用規模（数十〜数百）を想定し、JS 側でグルーピングする。
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const unauthorized = await requireAdmin(req)
  if (unauthorized) return unauthorized

  try {
    // 全チーム（作成日時の新しい順）
    const teamRows = await db
      .select({
        teamId: teams.teamId,
        name: teams.name,
        description: teams.description,
        requiredCount: teams.requiredCount,
        managementMode: teams.managementMode,
        createdAt: teams.createdAt,
      })
      .from(teams)
      .orderBy(desc(teams.createdAt))

    // 全メンバー（所属ユーザーの suspended も join で取得）
    const memberRows = await db
      .select({
        teamId: teamMembers.teamId,
        userId: teamMembers.userId,
        displayName: users.displayName,
        teamRole: teamMembers.teamRole,
        suspended: users.suspended,
        top: teamMembers.top,
        jungle: teamMembers.jungle,
        mid: teamMembers.mid,
        adc: teamMembers.adc,
        support: teamMembers.support,
      })
      .from(teamMembers)
      .innerJoin(users, eq(users.userId, teamMembers.userId))

    // userId → 紐づく Discord ID（複数可）のマップを作る
    const linkRows = await db.select({ userId: discordLinks.userId, discordUserId: discordLinks.discordUserId }).from(discordLinks)
    const discordIdsByUser = new Map<string, string[]>()
    for (const l of linkRows) {
      const list = discordIdsByUser.get(l.userId) ?? []
      list.push(l.discordUserId)
      discordIdsByUser.set(l.userId, list)
    }

    // teamId → メンバー配列
    const membersByTeam = new Map<string, AdminTeamMember[]>()
    for (const m of memberRows) {
      const roles: LolRoleFlags = { top: m.top, jungle: m.jungle, mid: m.mid, adc: m.adc, support: m.support }
      const member: AdminTeamMember = {
        userId: m.userId,
        displayName: m.displayName,
        teamRole: m.teamRole,
        suspended: m.suspended,
        discordUserIds: discordIdsByUser.get(m.userId) ?? [],
        roles,
      }
      const list = membersByTeam.get(m.teamId) ?? []
      list.push(member)
      membersByTeam.set(m.teamId, list)
    }

    const teamList: AdminTeam[] = teamRows.map((t) => ({
      teamId: t.teamId,
      name: t.name,
      description: t.description,
      requiredCount: t.requiredCount,
      managementMode: t.managementMode,
      createdAt: t.createdAt.toISOString(),
      members: membersByTeam.get(t.teamId) ?? [],
    }))

    // 無所属ユーザー（team_members に1行も無いユーザー）。
    // どのチームにも属していない userId の集合を team_members から除外して取得する。
    const memberUserIds = [...new Set(memberRows.map((m) => m.userId))]
    const orphanRows = await db
      .select({ userId: users.userId, displayName: users.displayName, suspended: users.suspended, createdAt: users.createdAt })
      .from(users)
      .where(memberUserIds.length > 0 ? notInArray(users.userId, memberUserIds) : undefined)
      .orderBy(desc(users.createdAt))

    const orphanUsers: AdminOrphanUser[] = orphanRows.map((u) => ({
      userId: u.userId,
      displayName: u.displayName,
      suspended: u.suspended,
      discordUserIds: discordIdsByUser.get(u.userId) ?? [],
      createdAt: u.createdAt.toISOString(),
    }))

    // チーム間スケジュール共有のペア一覧（#175）。チーム名は teamRows から解決する
    const nameByTeam = new Map(teamRows.map((t) => [t.teamId, t.name]))
    const shareRows = await db
      .select({ teamLow: teamShares.teamLow, teamHigh: teamShares.teamHigh, createdAt: teamShares.createdAt })
      .from(teamShares)
      .orderBy(desc(teamShares.createdAt))
    const shares: AdminShare[] = shareRows.map((s) => ({
      teamLow: { teamId: s.teamLow, name: nameByTeam.get(s.teamLow) ?? "(不明なチーム)" },
      teamHigh: { teamId: s.teamHigh, name: nameByTeam.get(s.teamHigh) ?? "(不明なチーム)" },
      createdAt: s.createdAt.toISOString(),
    }))

    const result: AdminOverview = { teams: teamList, orphanUsers, shares }
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("team-schedules admin overview GET error:", error)
    return NextResponse.json({ success: false, error: "管理データの取得に失敗しました" }, { status: 500 })
  }
}
