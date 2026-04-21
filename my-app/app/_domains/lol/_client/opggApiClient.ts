import type { EnemyTeam } from "@/app/_domains/lol/types"

const API_TEAMS = "/api/web/lol/ltk/teams"

const teamUrl = (name: string) => `${API_TEAMS}/${encodeURIComponent(name)}`

export async function fetchTeams(): Promise<EnemyTeam[]> {
  const res = await fetch(API_TEAMS)
  const json = (await res.json()) as { success: boolean; teams?: EnemyTeam[]; error?: string }
  if (!json.success) throw new Error(json.error ?? "取得失敗")
  return json.teams ?? []
}

export async function saveTeam(team: EnemyTeam): Promise<void> {
  const res = await fetch(API_TEAMS, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(team),
  })
  const json = (await res.json()) as { success: boolean; error?: string }
  if (!json.success) throw new Error(json.error ?? "保存失敗")
}

export async function deleteTeam(name: string): Promise<void> {
  const res = await fetch(API_TEAMS, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  })
  const json = (await res.json()) as { success: boolean; error?: string }
  if (!json.success) throw new Error(json.error ?? "削除失敗")
}

/** チーム名変更・メンバーリスト更新（送信したフィールドのみ上書き） */
export async function updateTeam(currentName: string, update: { name?: string; members?: string[] }): Promise<EnemyTeam> {
  const res = await fetch(`${teamUrl(currentName)}/add-member`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  })
  const json = (await res.json()) as { success: boolean; team?: EnemyTeam; error?: string }
  if (!json.success) throw new Error(json.error ?? "更新失敗")
  return json.team!
}

/** チームから1人を除名する */
export async function removeMember(teamName: string, member: string): Promise<EnemyTeam> {
  const res = await fetch(`${teamUrl(teamName)}/remove-member`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ member }),
  })
  const json = (await res.json()) as { success: boolean; team?: EnemyTeam; error?: string }
  if (!json.success) throw new Error(json.error ?? "除名失敗")
  return json.team!
}
