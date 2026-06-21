import type { AdminDiscordBan, AdminOverview } from "@/app/_domains/teamSchedules/types"

/**
 * スクリム調整 管理API（/api/web/team-schedules/admin/**）のクライアント（#166）。
 *
 * 開発者ログイン（localStorage.sessionToken の Bearer）を流用する（crud.ts と同じ流儀）。
 * 利用者の ts_session（Cookie）とは別系統。トークンが無ければ呼び出し前に例外を投げる。
 */

const API_BASE = "/api/web/team-schedules/admin"

type ApiResult<T> = { success: boolean; error?: string } & T

/** localStorage の開発者セッショントークンを取得（無ければ例外） */
function getAdminToken(): string {
  const token = typeof window !== "undefined" ? localStorage.getItem("sessionToken") : null
  if (!token) throw new Error("セッショントークンがありません。ログインしてください。")
  return token
}

/** Bearer 認証付き fetch ＋ レスポンス検証（crud.ts / teamSchedulesApiClient.ts の流儀を統合） */
async function request<T>(endpoint: string, init: { method: string; body?: object }, fallbackError: string): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { Authorization: `Bearer ${getAdminToken()}` }
  if (init.body !== undefined) headers["Content-Type"] = "application/json"

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: init.method,
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  })
  const json = (await res.json().catch(() => null)) as ApiResult<T> | null
  if (!res.ok || !json?.success) {
    throw new Error(json?.error ?? `${fallbackError}（HTTP ${res.status}）`)
  }
  return json
}

/** 全チーム＋設定＋メンバー＋無所属ユーザーを取得 */
export async function fetchAdminOverview(): Promise<AdminOverview> {
  const json = await request<AdminOverview>("/overview", { method: "GET" }, "管理データの取得に失敗しました")
  return { teams: json.teams ?? [], orphanUsers: json.orphanUsers ?? [] }
}

/** チームを強制解散する（取り消し不可） */
export async function adminDeleteTeam(teamId: string): Promise<void> {
  await request(`/teams/${encodeURIComponent(teamId)}`, { method: "DELETE" }, "チームの解散に失敗しました")
}

/** メンバーをチームから除外する */
export async function adminRemoveMember(teamId: string, userId: string): Promise<void> {
  await request(`/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`, { method: "DELETE" }, "メンバーの除外に失敗しました")
}

/** ユーザーアカウントを完全削除する（取り消し不可） */
export async function adminDeleteUser(userId: string): Promise<void> {
  await request(`/users/${encodeURIComponent(userId)}`, { method: "DELETE" }, "ユーザーの削除に失敗しました")
}

/** ユーザーの利用停止状態を切り替える（true=停止 / false=解除） */
export async function adminSetSuspended(userId: string, suspended: boolean): Promise<void> {
  const path = `/users/${encodeURIComponent(userId)}/suspend`
  await request(path, { method: suspended ? "POST" : "DELETE" }, "利用停止状態の更新に失敗しました")
}

/** Discord BAN 一覧を取得 */
export async function fetchDiscordBans(): Promise<AdminDiscordBan[]> {
  const json = await request<{ bans?: AdminDiscordBan[] }>("/discord-bans", { method: "GET" }, "BAN 一覧の取得に失敗しました")
  return json.bans ?? []
}

/** Discord ID を BAN に追加する */
export async function addDiscordBan(discordUserId: string, reason: string | null): Promise<AdminDiscordBan> {
  const json = await request<{ ban?: AdminDiscordBan }>("/discord-bans", { method: "POST", body: { discordUserId, reason } }, "BAN の追加に失敗しました")
  if (!json.ban) throw new Error("BAN の追加に失敗しました")
  return json.ban
}

/** Discord ID の BAN を解除する */
export async function removeDiscordBan(discordUserId: string): Promise<void> {
  await request(`/discord-bans/${encodeURIComponent(discordUserId)}`, { method: "DELETE" }, "BAN の解除に失敗しました")
}
