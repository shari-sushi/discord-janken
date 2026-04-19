"use client"

import { useState } from "react"
import type { EnemyTeam } from "@/app/_domains/lol/types"

export function TeamLoginMode({
  teams,
  myTeamName,
  onMyTeamNameChange,
  onSwitchToInput,
}: {
  teams: EnemyTeam[]
  myTeamName: string
  onMyTeamNameChange: (name: string) => void
  onSwitchToInput: () => void
}) {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<EnemyTeam | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const filtered = teams.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))

  const handleSelect = (team: EnemyTeam) => {
    setSelected(team)
    setQuery(team.name)
    setConfirmed(false)
  }

  const handleConfirm = () => {
    if (!selected) return
    onMyTeamNameChange(selected.name)
    setConfirmed(true)
  }

  return (
    <div className="space-y-4">
      {confirmed && selected && (
        <div className="bg-green-900/40 border border-green-700 rounded px-4 py-3 text-sm text-green-300">
          「{selected.name}」を自分のチームに設定しました。入力モードで解析すると自動除外されます。
          <button onClick={onSwitchToInput} className="ml-3 underline hover:text-green-100">
            入力モードへ
          </button>
        </div>
      )}

      {myTeamName && !confirmed && <p className="text-xs text-zinc-500">現在の自チーム: {myTeamName}</p>}

      <div>
        <label className="block mb-2 font-semibold text-sm text-zinc-300">チーム名を検索</label>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelected(null)
            setConfirmed(false)
          }}
          placeholder="チーム名を入力..."
          className="w-full bg-zinc-800 border border-zinc-600 text-white rounded px-3 py-2"
        />
      </div>

      {!selected && query.length > 0 && filtered.length > 0 && (
        <div className="border border-zinc-600 rounded overflow-hidden">
          {filtered.map((team) => (
            <button key={team.name} onClick={() => handleSelect(team)} className="w-full text-left px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border-b border-zinc-700 last:border-b-0 text-sm">
              <span className="font-semibold text-white">{team.name}</span>
              <span className="ml-2 text-zinc-400">({team.members.length}人)</span>
            </button>
          ))}
        </div>
      )}

      {!selected && query.length > 0 && filtered.length === 0 && (
        <div className="text-sm text-zinc-500 space-y-1">
          <p>「{query}」に一致するチームが見つかりません。</p>
          <p>
            チームが未登録の場合は、
            <button onClick={onSwitchToInput} className="text-blue-400 hover:text-blue-300 underline ml-1">
              入力モード
            </button>
            からチーム登録してください。
          </p>
        </div>
      )}

      {teams.length === 0 && (
        <div className="text-sm text-zinc-500 space-y-1">
          <p>チームがまだ登録されていません。</p>
          <p>
            <button onClick={onSwitchToInput} className="text-blue-400 hover:text-blue-300 underline">
              入力モード
            </button>
            からチーム登録してください。
          </p>
        </div>
      )}

      {selected && !confirmed && (
        <div className="space-y-2">
          <p className="text-sm text-zinc-400">
            選択中: <span className="text-white font-semibold">{selected.name}</span>
            <span className="ml-2 text-zinc-500 text-xs">({selected.members.length}人)</span>
          </p>
          <p className="text-xs text-zinc-500">{selected.members.join(", ")}</p>
          <button onClick={handleConfirm} className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-2 rounded text-sm">
            このチームを自分のチームとして設定
          </button>
        </div>
      )}
    </div>
  )
}
