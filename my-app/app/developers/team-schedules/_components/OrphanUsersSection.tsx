"use client"

import type { AdminOrphanUser } from "@/app/_domains/teamSchedules/types"
import { formatDateTime, formatDiscordIds } from "../_utils"
import { SuspendBadge } from "./SuspendBadge"

type Props = {
  users: AdminOrphanUser[]
  onDeleteUser: (userId: string, displayName: string) => void
  onToggleSuspend: (userId: string, nextSuspended: boolean) => void
}

/** ② どのチームにも所属していないユーザー（削除 / 利用停止切替） */
export function OrphanUsersSection({ users, onDeleteUser, onToggleSuspend }: Props) {
  return (
    <section>
      <h2 className="mb-1 text-lg font-bold">無所属ユーザー（{users.length}）</h2>
      <p className="mb-3 text-xs text-zinc-400">どのチームにも所属していないユーザー。テスト用アカウントの掃除などに利用します。</p>
      {users.length === 0 ? (
        <p className="text-sm text-zinc-400">無所属ユーザーはいません。</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-700 bg-zinc-900/60">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-700 text-left text-xs text-zinc-400">
                <th className="px-3 py-2 font-medium">表示名</th>
                <th className="px-3 py-2 font-medium">Discord ID</th>
                <th className="px-3 py-2 font-medium">作成</th>
                <th className="px-3 py-2 font-medium">状態</th>
                <th className="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.userId} className="border-b border-zinc-800 align-top">
                  <td className="px-3 py-2">{u.displayName}</td>
                  <td className="px-3 py-2 break-all font-mono text-[11px] text-zinc-400">{formatDiscordIds(u.discordUserIds)}</td>
                  <td className="px-3 py-2 text-zinc-300">{formatDateTime(u.createdAt)}</td>
                  <td className="px-3 py-2">
                    <SuspendBadge suspended={u.suspended} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onToggleSuspend(u.userId, !u.suspended)}
                        className="rounded-md border border-zinc-600 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                      >
                        {u.suspended ? "停止解除" : "利用停止"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteUser(u.userId, u.displayName)}
                        className="rounded-md border border-rose-700 px-2 py-1 text-xs text-rose-300 hover:bg-rose-950/50"
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
