"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { AdminDiscordBan, AdminOverview } from "@/app/_domains/teamSchedules/types"
import {
  addDiscordBan,
  adminDeleteTeam,
  adminDeleteUser,
  adminRemoveMember,
  adminSetSuspended,
  fetchAdminOverview,
  fetchDiscordBans,
  removeDiscordBan,
} from "@/app/_client/lib/apiClient/teamSchedulesAdmin"
import { TeamsSection } from "./TeamsSection"
import { OrphanUsersSection } from "./OrphanUsersSection"
import { SharesSection } from "./SharesSection"
import { DiscordBanSection } from "./DiscordBanSection"

/**
 * 管理ページ本体。データ取得・破壊的操作のハンドリング・レイアウトを担う。
 * 破壊的操作は window.confirm で確認を挟む（admin 専用ツールのため簡易確認で十分）。
 */
export function TeamSchedulesAdminPage() {
  const router = useRouter()
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [bans, setBans] = useState<AdminDiscordBan[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // 未ログインは /login へ（開発者ログインを流用）
  useEffect(() => {
    if (!localStorage.getItem("sessionToken")) router.push("/login")
  }, [router])

  const reload = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [ov, bs] = await Promise.all([fetchAdminOverview(), fetchDiscordBans()])
      setOverview(ov)
      setBans(bs)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "読み込みに失敗しました")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  /** 破壊的操作の共通ラッパー。失敗はメッセージ表示、成功は再読み込み */
  const run = useCallback(
    async (action: () => Promise<void>) => {
      setActionError(null)
      try {
        await action()
        await reload()
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "操作に失敗しました")
      }
    },
    [reload],
  )

  const handleDeleteTeam = (teamId: string, name: string) => {
    if (!window.confirm(`チーム「${name}」を強制解散します。メンバー所属・予定もすべて削除され、取り消せません。実行しますか？`)) return
    void run(() => adminDeleteTeam(teamId))
  }

  const handleRemoveMember = (teamId: string, userId: string, displayName: string) => {
    if (!window.confirm(`「${displayName}」をこのチームから除外します。実行しますか？`)) return
    void run(() => adminRemoveMember(teamId, userId))
  }

  const handleDeleteUser = (userId: string, displayName: string) => {
    if (!window.confirm(`ユーザー「${displayName}」を完全削除します。所属・予定・Discord紐づけもすべて削除され、取り消せません。実行しますか？`)) return
    void run(() => adminDeleteUser(userId))
  }

  const handleToggleSuspend = (userId: string, nextSuspended: boolean) => {
    void run(() => adminSetSuspended(userId, nextSuspended))
  }

  // BAN 追加はフォーム側（DiscordBanSection）でエラー表示するため run() で握り潰さず例外を伝播させる。
  // 成功時のみ再読み込みする（失敗時は例外を投げ、フォームの入力値を保持したままインラインで表示）。
  const handleAddBan = async (discordUserId: string, reason: string | null) => {
    setActionError(null)
    await addDiscordBan(discordUserId, reason)
    await reload()
  }

  const handleRemoveBan = (discordUserId: string) => {
    if (!window.confirm(`Discord ID「${discordUserId}」の BAN を解除します。実行しますか？`)) return
    void run(() => removeDiscordBan(discordUserId))
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl overflow-x-hidden p-4 text-zinc-100 sm:p-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">スクリム調整 管理画面</h1>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading}
          className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? "読み込み中…" : "再読み込み"}
        </button>
      </header>

      {loadError && <p className="mb-4 rounded-lg border border-rose-700 bg-rose-950/50 p-3 text-sm text-rose-300">{loadError}</p>}
      {actionError && <p className="mb-4 rounded-lg border border-rose-700 bg-rose-950/50 p-3 text-sm text-rose-300">{actionError}</p>}

      {loading && !overview ? (
        <p className="text-sm text-zinc-400">読み込み中…</p>
      ) : overview ? (
        <div className="space-y-10">
          <TeamsSection teams={overview.teams} onDeleteTeam={handleDeleteTeam} onRemoveMember={handleRemoveMember} onToggleSuspend={handleToggleSuspend} />
          <OrphanUsersSection users={overview.orphanUsers} onDeleteUser={handleDeleteUser} onToggleSuspend={handleToggleSuspend} />
          <SharesSection shares={overview.shares} />
          <DiscordBanSection bans={bans} onAddBan={handleAddBan} onRemoveBan={handleRemoveBan} />
        </div>
      ) : null}
    </div>
  )
}
