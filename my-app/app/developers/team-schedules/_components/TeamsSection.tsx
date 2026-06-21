"use client"

import type { AdminTeam } from "@/app/_domains/teamSchedules/types"
import { formatDateTime, formatDiscordIds, formatRoles } from "../_utils"
import { SuspendBadge } from "./SuspendBadge"

type Props = {
  teams: AdminTeam[]
  onDeleteTeam: (teamId: string, name: string) => void
  onRemoveMember: (teamId: string, userId: string, displayName: string) => void
  onToggleSuspend: (userId: string, nextSuspended: boolean) => void
}

const MODE_LABEL: Record<AdminTeam["managementMode"], string> = { members: "メンバー集計", team: "チーム単位" }

/** ① チーム一覧＋設定＋メンバー（強制解散 / メンバー除外 / 利用停止切替） */
export function TeamsSection({ teams, onDeleteTeam, onRemoveMember, onToggleSuspend }: Props) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">チーム一覧（{teams.length}）</h2>
      {teams.length === 0 ? (
        <p className="text-sm text-zinc-400">チームはありません。</p>
      ) : (
        <div className="space-y-5">
          {teams.map((team) => (
            <div key={team.teamId} className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-bold">{team.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    モード: {MODE_LABEL[team.managementMode]} / 活動可能人数: {team.requiredCount} / 作成: {formatDateTime(team.createdAt)}
                  </p>
                  <p className="mt-0.5 break-all font-mono text-[11px] text-zinc-500">team_id: {team.teamId}</p>
                  {team.description && <p className="mt-1 text-sm text-zinc-300">{team.description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteTeam(team.teamId, team.name)}
                  className="shrink-0 rounded-lg bg-rose-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-600"
                >
                  強制解散
                </button>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-zinc-700 text-left text-xs text-zinc-400">
                      <th className="px-2 py-1.5 font-medium">表示名</th>
                      <th className="px-2 py-1.5 font-medium">ロール</th>
                      <th className="px-2 py-1.5 font-medium">担当</th>
                      <th className="px-2 py-1.5 font-medium">Discord ID</th>
                      <th className="px-2 py-1.5 font-medium">状態</th>
                      <th className="px-2 py-1.5 text-right font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.members.map((m) => (
                      <tr key={m.userId} className="border-b border-zinc-800 align-top">
                        <td className="px-2 py-1.5">{m.displayName}</td>
                        <td className="px-2 py-1.5">{m.teamRole}</td>
                        <td className="px-2 py-1.5 text-zinc-300">{formatRoles(m.roles)}</td>
                        <td className="px-2 py-1.5 break-all font-mono text-[11px] text-zinc-400">{formatDiscordIds(m.discordUserIds)}</td>
                        <td className="px-2 py-1.5">
                          <SuspendBadge suspended={m.suspended} />
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onToggleSuspend(m.userId, !m.suspended)}
                              className="rounded-md border border-zinc-600 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                            >
                              {m.suspended ? "停止解除" : "利用停止"}
                            </button>
                            {m.teamRole !== "master" && (
                              <button
                                type="button"
                                onClick={() => onRemoveMember(team.teamId, m.userId, m.displayName)}
                                className="rounded-md border border-rose-700 px-2 py-1 text-xs text-rose-300 hover:bg-rose-950/50"
                              >
                                除外
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
