"use client"

import type { TeamSummary } from "@/app/_domains/teamSchedules/types"
import { CreateTeamForm } from "./CreateTeamForm"

type CreateTeamModalProps = {
  onClose: () => void
  onCreated: (team: TeamSummary) => void
}

/** チームを新規作成するフォームモーダル（参加上限内のユーザーのみ開ける） */
export function CreateTeamModal({ onClose, onCreated }: CreateTeamModalProps) {
  return (
    <div className="w-[min(92vw,440px)] rounded-xl border border-zinc-700 bg-zinc-900 p-6 text-zinc-100 shadow-xl">
      <h2 className="text-base font-bold text-zinc-100">チームを作成</h2>
      <div className="mt-4">
        <CreateTeamForm onCreated={onCreated} onCancel={onClose} />
      </div>
    </div>
  )
}
