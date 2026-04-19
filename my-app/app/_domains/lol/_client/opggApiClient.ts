import type { EnemyTeam } from "@/app/_domains/lol/types"

const API_TEAMS = "/api/web/lol/ltk/teams"

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
