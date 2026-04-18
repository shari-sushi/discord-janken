"use client"

import { useState } from "react"
import type { EnemyTeam } from "@/app/domains/lol/types"
import type { Player } from "../_types"
import { PlayerListAndUrl } from "./PlayerListAndUrl"

export function TeamSearchMode({ enemyTeams }: { enemyTeams: EnemyTeam[] }) {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<EnemyTeam | null>(null)
  const [players, setPlayers] = useState<Player[]>([])

  const filtered = enemyTeams.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))

  const handleSelect = (team: EnemyTeam) => {
    setSelected(team)
    setPlayers(team.members.map((name) => ({ name, checked: true })))
    setQuery(team.name)
  }

  const togglePlayer = (i: number) => {
    setPlayers((prev) => prev.map((p, idx) => (idx === i ? { ...p, checked: !p.checked } : p)))
  }

  return (
    <div>
      <div className="mb-4">
        <label className="block mb-2 font-semibold text-sm text-zinc-300">チーム名を検索</label>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelected(null)
            setPlayers([])
          }}
          placeholder="チーム名を入力..."
          className="w-full bg-zinc-800 border border-zinc-600 text-white rounded px-3 py-2"
        />
      </div>

      {!selected && query.length > 0 && filtered.length > 0 && (
        <div className="mb-4 border border-zinc-600 rounded overflow-hidden">
          {filtered.map((team) => (
            <button key={team.name} onClick={() => handleSelect(team)} className="w-full text-left px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border-b border-zinc-700 last:border-b-0 text-sm">
              <span className="font-semibold text-white">{team.name}</span>
              <span className="ml-2 text-zinc-400">({team.members.length}人)</span>
            </button>
          ))}
        </div>
      )}

      {!selected && query.length > 0 && filtered.length === 0 && <p className="text-zinc-500 text-sm mb-4">「{query}」に一致するチームが見つかりません</p>}

      {enemyTeams.length === 0 && <p className="text-zinc-500 text-sm mb-4">相手チームが登録されていません。設定から登録してください。</p>}

      {selected && players.length > 0 && (
        <div>
          <p className="text-sm text-zinc-400 mb-2">
            選択: <span className="text-white font-semibold">{selected.name}</span>
          </p>
          <PlayerListAndUrl players={players} onToggle={togglePlayer} />
        </div>
      )}
    </div>
  )
}
