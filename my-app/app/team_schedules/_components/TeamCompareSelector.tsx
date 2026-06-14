"use client"

import type { TeamSummary } from "@/app/_domains/teamSchedules/types"

type TeamCompareSelectorProps = {
  teams: TeamSummary[]
  ownTeamId: string | null
  opponentTeamIds: string[]
  onOwnTeamChange: (teamId: string | null) => void
  onOpponentsChange: (teamIds: string[]) => void
}

/** 比較するチーム（自チーム + 相手チーム複数）を選ぶ in-page セレクタ */
export function TeamCompareSelector({ teams, ownTeamId, opponentTeamIds, onOwnTeamChange, onOpponentsChange }: TeamCompareSelectorProps) {
  const toggleOpponent = (teamId: string) => {
    if (opponentTeamIds.includes(teamId)) {
      onOpponentsChange(opponentTeamIds.filter((id) => id !== teamId))
    } else {
      onOpponentsChange([...opponentTeamIds, teamId])
    }
  }

  // 自チームに選ばれているチームは相手候補から除外
  const opponentCandidates = teams.filter((t) => t.teamId !== ownTeamId)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
      <label className="flex items-center gap-2">
        <span className="text-slate-500">自チーム</span>
        <select
          value={ownTeamId ?? ""}
          onChange={(e) => onOwnTeamChange(e.target.value || null)}
          className="rounded border border-slate-300 bg-white px-2 py-1 font-medium text-slate-800 focus:border-indigo-400 focus:outline-none"
        >
          <option value="">選択してください</option>
          {teams.map((t) => (
            <option key={t.teamId} value={t.teamId}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-slate-500">相手チーム</span>
        {opponentCandidates.length === 0 ? (
          <span className="text-xs text-slate-400">候補がありません</span>
        ) : (
          opponentCandidates.map((t) => {
            const checked = opponentTeamIds.includes(t.teamId)
            return (
              <button
                key={t.teamId}
                type="button"
                onClick={() => toggleOpponent(t.teamId)}
                className={
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors " +
                  (checked ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-300 bg-white text-slate-500 hover:border-slate-400")
                }
              >
                {checked ? "✓ " : ""}
                {t.name}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
