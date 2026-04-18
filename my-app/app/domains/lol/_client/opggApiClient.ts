import type { EnemyTeam } from "@/app/domains/lol/types"

const API_SELF_TEAM = "/api/web/lol/opgg/self-team"
const API_ENEMY_TEAMS = "/api/web/lol/opgg/enemy-teams"

export async function fetchSelfTeam(auth: string): Promise<string[]> {
  const res = await fetch(API_SELF_TEAM, { headers: { Authorization: auth } })
  const json = (await res.json()) as { success: boolean; members?: string[]; error?: string }
  if (!json.success) throw new Error(json.error ?? "取得失敗")
  return json.members ?? []
}

export async function saveSelfTeam(auth: string, members: string[]): Promise<void> {
  const res = await fetch(API_SELF_TEAM, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({ members }),
  })
  const json = (await res.json()) as { success: boolean; error?: string }
  if (!json.success) throw new Error(json.error ?? "保存失敗")
}

export async function fetchEnemyTeams(auth: string): Promise<EnemyTeam[]> {
  const res = await fetch(API_ENEMY_TEAMS, { headers: { Authorization: auth } })
  const json = (await res.json()) as { success: boolean; teams?: EnemyTeam[]; error?: string }
  if (!json.success) throw new Error(json.error ?? "取得失敗")
  return json.teams ?? []
}

export async function saveEnemyTeam(auth: string, team: EnemyTeam): Promise<void> {
  const res = await fetch(API_ENEMY_TEAMS, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify(team),
  })
  const json = (await res.json()) as { success: boolean; error?: string }
  if (!json.success) throw new Error(json.error ?? "保存失敗")
}

export async function deleteEnemyTeam(auth: string, name: string): Promise<void> {
  const res = await fetch(API_ENEMY_TEAMS, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({ name }),
  })
  const json = (await res.json()) as { success: boolean; error?: string }
  if (!json.success) throw new Error(json.error ?? "削除失敗")
}
