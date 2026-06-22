"use client"

import type { AdminShare } from "@/app/_domains/teamSchedules/types"
import { formatDateTime } from "../_utils"

type Props = {
  shares: AdminShare[]
}

/** ③ チーム間スケジュール共有のペア一覧（#175・閲覧専用） */
export function SharesSection({ shares }: Props) {
  return (
    <section>
      <h2 className="mb-1 text-lg font-bold">スケジュール共有（{shares.length}）</h2>
      <p className="mb-3 text-xs text-zinc-400">どのチームとどのチームが互いの活動可能日を共有しているか。共有は対称（双方向）です。</p>
      {shares.length === 0 ? (
        <p className="text-sm text-zinc-400">共有しているチームはありません。</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-700 bg-zinc-900/60">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-700 text-left text-xs text-zinc-400">
                <th className="px-3 py-2 font-medium">チーム</th>
                <th className="px-3 py-2 font-medium">チーム</th>
                <th className="px-3 py-2 font-medium">共有開始</th>
              </tr>
            </thead>
            <tbody>
              {shares.map((s) => (
                <tr key={`${s.teamLow.teamId}:${s.teamHigh.teamId}`} className="border-b border-zinc-800 align-top">
                  <td className="px-3 py-2 text-zinc-200">{s.teamLow.name}</td>
                  <td className="px-3 py-2 text-zinc-200">{s.teamHigh.name}</td>
                  <td className="px-3 py-2 text-zinc-300">{formatDateTime(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
