"use client"

import { useOverlay } from "@/app/_client/lib/modal/ModalContext"
import { analyzeSummonersText } from "@/app/_domains/lol/analyzeSummonersText"
import type { EnemyTeam } from "@/app/_domains/lol/types"
import type { Player } from "../_types"
import { PlayerListAndUrl } from "./PlayerListAndUrl"
import { RegisterTeamOverlay } from "./RegisterTeamOverlay"

export function InputMode({
  selfTeam,
  onTeamsChange,
  onMyTeamNameChange,
  text,
  onTextChange,
  players,
  onPlayersChange,
  excludeSelf,
  onExcludeSelfChange,
}: {
  selfTeam: string[]
  onTeamsChange: (teams: EnemyTeam[]) => void
  onMyTeamNameChange: (name: string) => void
  text: string
  onTextChange: (text: string) => void
  players: Player[]
  onPlayersChange: (players: Player[]) => void
  excludeSelf: boolean
  onExcludeSelfChange: (v: boolean) => void
}) {
  const { open } = useOverlay()

  const handleAnalyze = () => {
    onPlayersChange(analyzeSummonersText(text, excludeSelf ? selfTeam : []))
  }

  const togglePlayer = (i: number) => {
    onPlayersChange(players.map((p, idx) => (idx === i ? { ...p, checked: !p.checked } : p)))
  }

  const handleOpenRegister = () => {
    open(<RegisterTeamOverlay initialPlayers={players} onTeamsSaved={onTeamsChange} onMyTeamNameChange={onMyTeamNameChange} onPlayersChange={onPlayersChange} />)
  }

  return (
    <div>
      <div className="mb-4">
        <label className="block mb-2 font-semibold text-sm text-zinc-300">ロビーログ / Discord メンション / プレーンテキストを貼り付け</label>
        <textarea
          className="w-full bg-zinc-800 border border-zinc-600 text-white rounded px-3 py-2 h-40 resize-y text-sm"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={"ROX Smeb さんが部屋に参加しました。\n@Name#TAG\nplayer3"}
        />
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={handleAnalyze} disabled={!text.trim()} className="bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2 rounded">
          解析・除外
        </button>
        {selfTeam.length > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none">
            <input type="checkbox" checked={excludeSelf} onChange={(e) => onExcludeSelfChange(e.target.checked)} className="accent-blue-500" />
            自チーム {selfTeam.length} 人を除外
          </label>
        )}
      </div>
      {players.length > 0 && <PlayerListAndUrl players={players} onToggle={togglePlayer} onOpenRegister={handleOpenRegister} />}
    </div>
  )
}
