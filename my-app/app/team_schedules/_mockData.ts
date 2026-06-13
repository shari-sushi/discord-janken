import type { ScheduleEntry, ScheduleStatus, SessionUser, TeamSchedule, TeamSummary } from "@/app/_domains/teamSchedules/types"

/**
 * サーバーAPI（別作業で実装予定）が未接続のときに UI を確認できるようにする
 * フォールバック用モックデータ。API が応答するようになれば使われなくなる。
 */

const OWN_MEMBER_NAMES = ["自A", "自B", "自C", "自D", "自E", "自F"]

const noRoles = { top: false, jungle: false, mid: false, adc: false, support: false }

function ownStatus(dayIndex: number, memberIndex: number): ScheduleStatus | null {
  const r = (dayIndex * 5 + memberIndex * 7) % 12
  if (r === 0 || r === 1) return "ng"
  if (r === 2) return "maybe"
  if (r === 3) return null // 未記入
  return "ok"
}

function oppStatus(dayIndex: number, seed: number): ScheduleStatus | null {
  const v = (dayIndex * seed) % 4
  if (v === 0) return null // 未記入
  if (v === 1) return "ng"
  if (v === 2) return "maybe"
  return "ok"
}

export type MockData = {
  teams: TeamSummary[]
  schedulesByTeam: Record<string, TeamSchedule>
  session: SessionUser
}

export function buildMockData(dayKeys: string[]): MockData {
  // 自チーム
  const ownMembers = OWN_MEMBER_NAMES.map((name, i) => ({
    userId: `own-${i}`,
    displayName: name,
    teamRole: (i === 0 ? "admin" : "individual") as "admin" | "individual",
    roles: { ...noRoles },
  }))
  const ownSchedules: ScheduleEntry[] = []
  ownMembers.forEach((m, mi) => {
    dayKeys.forEach((day, di) => {
      const status = ownStatus(di, mi)
      if (status) ownSchedules.push({ userId: m.userId, day, status, note: status === "ok" && di % 4 === 0 ? "21~" : null })
    })
  })
  const ownTeam: TeamSchedule = {
    teamId: "own",
    name: "自チーム",
    description: null,
    requiredCount: 5,
    members: ownMembers,
    schedules: ownSchedules,
  }

  // 相手チーム（代表1人・requiredCount=1）
  const makeOpponent = (teamId: string, name: string, seed: number): TeamSchedule => {
    const rep = { userId: `${teamId}-rep`, displayName: `${name}代表`, teamRole: "admin" as const, roles: { ...noRoles } }
    const schedules: ScheduleEntry[] = []
    dayKeys.forEach((day, di) => {
      const status = oppStatus(di, seed)
      if (status) schedules.push({ userId: rep.userId, day, status, note: status === "ok" && di % 3 === 0 ? "21:00~" : null })
    })
    return { teamId, name, description: null, requiredCount: 1, members: [rep], schedules }
  }
  const oppA = makeOpponent("opp-a", "相手A", 2)
  const oppB = makeOpponent("opp-b", "相手B", 3)

  return {
    teams: [
      { teamId: ownTeam.teamId, name: ownTeam.name, description: null, requiredCount: 5 },
      { teamId: oppA.teamId, name: oppA.name, description: null, requiredCount: 1 },
      { teamId: oppB.teamId, name: oppB.name, description: null, requiredCount: 1 },
    ],
    schedulesByTeam: { [ownTeam.teamId]: ownTeam, [oppA.teamId]: oppA, [oppB.teamId]: oppB },
    // デモ用に自チームの一員としてログイン済み扱いにする（自C列が編集可能になる）
    session: { userId: "own-2", displayName: "自C" },
  }
}
