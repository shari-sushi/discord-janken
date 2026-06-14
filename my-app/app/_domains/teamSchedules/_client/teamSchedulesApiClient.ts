import type { DayKey, ScheduleStatus, SessionUser, TeamManagementMode, TeamSchedule, TeamSummary } from "@/app/_domains/teamSchedules/types"

/**
 * スクリム調整機能の Web API クライアント。
 * サーバー側（別作業）が `/api/web/team-schedules/**` を実装する前提の契約。
 */

const API_BASE = "/api/web/team-schedules"

type ApiResult<T> = { success: boolean; error?: string } & T

async function parse<T>(res: Response, fallbackError: string): Promise<ApiResult<T>> {
  const json = (await res.json()) as ApiResult<T>
  if (!json.success) throw new Error(json.error ?? fallbackError)
  return json
}

/** magic-link トークンを検証してログインする（成功でセッションCookieが設定される） */
export async function verifyMagicLink(token: string): Promise<SessionUser> {
  const res = await fetch(`${API_BASE}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  })
  const json = await parse<{ user?: SessionUser }>(res, "ログインに失敗しました")
  if (!json.user) throw new Error("ログインに失敗しました")
  return json.user
}

/** ログイン中ユーザーを取得（未ログインなら null） */
export async function fetchSession(): Promise<SessionUser | null> {
  const res = await fetch(`${API_BASE}/session`, { cache: "no-store" })
  if (res.status === 401) return null
  const json = await parse<{ user?: SessionUser | null }>(res, "セッション取得失敗")
  return json.user ?? null
}

/** チーム一覧を取得（比較セレクタ用・public read） */
export async function fetchTeams(): Promise<TeamSummary[]> {
  const res = await fetch(`${API_BASE}/teams`, { cache: "no-store" })
  const json = await parse<{ teams?: TeamSummary[] }>(res, "チーム一覧の取得に失敗しました")
  return json.teams ?? []
}

/** 指定チームの予定を期間指定で取得（public read） */
export async function fetchTeamSchedule(teamId: string, from: DayKey, to: DayKey): Promise<TeamSchedule> {
  const params = new URLSearchParams({ from, to })
  const res = await fetch(`${API_BASE}/teams/${encodeURIComponent(teamId)}/schedule?${params}`, { cache: "no-store" })
  const json = await parse<{ team?: TeamSchedule }>(res, "予定の取得に失敗しました")
  if (!json.team) throw new Error("予定の取得に失敗しました")
  return json.team
}

/** チームを新規作成する（要ログイン + 作成権限）。作成者は admin になる */
export async function createTeam(input: { name: string; description: string | null; managementMode: TeamManagementMode; requiredCount: number }): Promise<TeamSummary> {
  const res = await fetch(`${API_BASE}/teams`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const json = await parse<{ team?: TeamSummary }>(res, "チームの作成に失敗しました")
  if (!json.team) throw new Error("チームの作成に失敗しました")
  return json.team
}

/** チームの招待リンクを発行する（要ログイン + admin）。参加用URLを返す */
export async function createInvite(teamId: string): Promise<{ url: string; expiryDays: number }> {
  const res = await fetch(`${API_BASE}/teams/${encodeURIComponent(teamId)}/invite`, { method: "POST" })
  const json = await parse<{ url?: string; expiryDays?: number }>(res, "招待リンクの発行に失敗しました")
  if (!json.url) throw new Error("招待リンクの発行に失敗しました")
  return { url: json.url, expiryDays: json.expiryDays ?? 0 }
}

/** 招待トークンでチームに参加する（要ログイン）。参加したチームを返す */
export async function joinTeam(token: string): Promise<TeamSummary> {
  const res = await fetch(`${API_BASE}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  })
  const json = await parse<{ team?: TeamSummary }>(res, "チームへの参加に失敗しました")
  if (!json.team) throw new Error("チームへの参加に失敗しました")
  return json.team
}

/** 自分の予定を1日ぶん登録/更新（要ログイン） */
export async function upsertSchedule(input: { teamId: string; day: DayKey; status: ScheduleStatus; note: string | null }): Promise<void> {
  const res = await fetch(`${API_BASE}/teams/${encodeURIComponent(input.teamId)}/schedule`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ day: input.day, status: input.status, note: input.note }),
  })
  await parse(res, "予定の保存に失敗しました")
}

/** 自分の予定を1日ぶん削除（未記入に戻す・要ログイン） */
export async function deleteSchedule(input: { teamId: string; day: DayKey }): Promise<void> {
  const res = await fetch(`${API_BASE}/teams/${encodeURIComponent(input.teamId)}/schedule`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ day: input.day }),
  })
  await parse(res, "予定の削除に失敗しました")
}

/** チーム単位モードの日別状態を1日ぶん登録/更新（要ログイン + admin） */
export async function upsertTeamStatus(input: { teamId: string; day: DayKey; status: ScheduleStatus; note: string | null }): Promise<void> {
  const res = await fetch(`${API_BASE}/teams/${encodeURIComponent(input.teamId)}/team-status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ day: input.day, status: input.status, note: input.note }),
  })
  await parse(res, "チーム状態の保存に失敗しました")
}

/** チーム単位モードの日別状態を1日ぶん削除（未記入に戻す・要ログイン + admin） */
export async function deleteTeamStatus(input: { teamId: string; day: DayKey }): Promise<void> {
  const res = await fetch(`${API_BASE}/teams/${encodeURIComponent(input.teamId)}/team-status`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ day: input.day }),
  })
  await parse(res, "チーム状態の削除に失敗しました")
}
