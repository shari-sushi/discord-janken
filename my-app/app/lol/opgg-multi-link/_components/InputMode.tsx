"use client"

import { useState } from "react"
import { useOverlay } from "@/app/_client/lib/modal/ModalContext"
import { analyzeSummonersText } from "@/app/domains/lol/analyzeSummonersText"
import type { EnemyTeam } from "@/app/domains/lol/types"
import type { Player } from "../_types"
import { PlayerListAndUrl } from "./PlayerListAndUrl"
import { RegisterTeamOverlay } from "./RegisterTeamOverlay"

export function InputMode({
  selfTeam,
  auth,
  onEnemyTeamsChange,
  onSelfTeamChange,
}: {
  selfTeam: string[]
  auth: string
  onEnemyTeamsChange: (teams: EnemyTeam[]) => void
  onSelfTeamChange: (members: string[]) => void
}) {
  const { open } = useOverlay()
  const [text, setText] = useState("")
  const [players, setPlayers] = useState<Player[]>([])

  const handleAnalyze = () => {
    setPlayers(analyzeSummonersText(text, selfTeam))
  }

  const togglePlayer = (i: number) => {
    setPlayers((prev) => prev.map((p, idx) => (idx === i ? { ...p, checked: !p.checked } : p)))
  }

  const handleOpenRegister = () => {
    open(<RegisterTeamOverlay initialPlayers={players} auth={auth} onEnemySaved={onEnemyTeamsChange} onSelfSaved={onSelfTeamChange} />)
  }

  return (
    <div>
      <div className="mb-4">
        <label className="block mb-2 font-semibold text-sm text-zinc-300">ロビーログ / Discord メンション / プレーンテキストを貼り付け</label>
        <textarea
          className="w-full bg-zinc-800 border border-zinc-600 text-white rounded px-3 py-2 h-40 resize-y text-sm"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"ROX Smeb さんが部屋に参加しました。\n@Name#TAG\nplayer3"}
        />
      </div>
      <button onClick={handleAnalyze} disabled={!text.trim()} className="bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2 rounded">
        解析・除外
      </button>
      {selfTeam.length > 0 && <span className="ml-3 text-xs text-zinc-500">自チーム {selfTeam.length} 人を除外します</span>}
      {players.length > 0 && <PlayerListAndUrl players={players} onToggle={togglePlayer} onOpenRegister={handleOpenRegister} />}
    </div>
  )
}
