"use client"

import type { EnemyTeam } from "@/app/_domains/lol/types"
import type { Player } from "../_types"
import { PlayerListAndUrl } from "./PlayerListAndUrl"

export function TeamSearchMode({
  teams,
  query,
  onQueryChange,
  selected,
  onSelectedChange,
  players,
  onPlayersChange,
  onSwitchToInput,
}: {
  teams: EnemyTeam[]
  query: string
  onQueryChange: (q: string) => void
  selected: EnemyTeam | null
  onSelectedChange: (t: EnemyTeam | null) => void
  players: Player[]
  onPlayersChange: (players: Player[]) => void
  onSwitchToInput?: () => void
}) {
  const filtered = teams.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))

  const handleSelect = (team: EnemyTeam) => {
    onSelectedChange(team)
    onPlayersChange(team.members.map((name) => ({ name, checked: true })))
    onQueryChange(team.name)
  }

  const togglePlayer = (i: number) => {
    onPlayersChange(players.map((p, idx) => (idx === i ? { ...p, checked: !p.checked } : p)))
  }

  return (
    <div>
      <div className="mb-4">
        <label className="block mb-2 font-semibold text-sm text-zinc-300">チーム名を検索</label>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value)
            onSelectedChange(null)
            onPlayersChange([])
          }}
          placeholder="チーム名を入力..."
          className="w-full bg-zinc-800 border border-zinc-600 text-white rounded px-3 py-2"
        />
      </div>

      {!selected && filtered.length > 0 && (
        <div>
          {query.length === 0 && <p className="text-xs text-zinc-500 mb-1">登録チーム ({filtered.length})</p>}
          <div className="border border-zinc-600 rounded overflow-hidden max-h-72 overflow-y-auto">
            {filtered.map((team) => (
              <button key={team.name} onClick={() => handleSelect(team)} className="w-full text-left px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border-b border-zinc-700 last:border-b-0 text-sm min-w-0">
                <div className="flex items-baseline min-w-0 overflow-hidden">
                  <span className="font-semibold text-white shrink-0">{team.name}</span>
                  <span className="text-zinc-400 shrink-0 ml-1">({team.members.length}人)</span>
                </div>
              </button>
            ))}
          </div>
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
