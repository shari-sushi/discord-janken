"use client"

import { useState } from "react"
import { useOverlay } from "@/app/_client/lib/modal/ModalContext"
import { TabSelector } from "@/app/_client/components/TabSelector"
import type { EnemyTeam } from "@/app/_domains/lol/types"
import { saveSelfTeam, saveEnemyTeam, fetchEnemyTeams } from "@/app/_domains/lol/_client/opggApiClient"
import type { Player, TeamType } from "../_types"
import { PlayerListAndUrl } from "./PlayerListAndUrl"

export function RegisterTeamOverlay({
  initialPlayers,
  auth,
  onEnemySaved,
  onSelfSaved,
}: {
  initialPlayers: Player[]
  auth: string
  onEnemySaved: (teams: EnemyTeam[]) => void
  onSelfSaved: (members: string[]) => void
}) {
  const { close } = useOverlay()
  const [players, setPlayers] = useState<Player[]>(initialPlayers)
  const [teamType, setTeamType] = useState<TeamType>("enemy")
  const [teamName, setTeamName] = useState("")
  const [msg, setMsg] = useState("")

  const togglePlayer = (i: number) => {
    setPlayers((prev) => prev.map((p, idx) => (idx === i ? { ...p, checked: !p.checked } : p)))
  }

  const handleRegister = async () => {
    setMsg("")
    const members = players.filter((p) => p.checked).map((p) => p.name)
    if (members.length === 0) {
      setMsg("メンバーを1人以上選択してください")
      return
    }
    try {
      if (teamType === "self") {
        await saveSelfTeam(auth, members)
        onSelfSaved(members)
      } else {
        if (!teamName.trim()) {
          setMsg("チーム名を入力してください")
          return
        }
        await saveEnemyTeam(auth, { name: teamName.trim(), members })
        const updated = await fetchEnemyTeams(auth)
        onEnemySaved(updated)
      }
      close()
    } catch (e) {
      setMsg(`エラー: ${e instanceof Error ? e.message : "不明"}`)
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full h-full p-5 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="text-lg font-bold">チーム登録</h2>
          <TabSelector
            tabs={[
              { id: "enemy" as TeamType, label: "相手チーム" },
              { id: "self" as TeamType, label: "自分のチーム" },
            ]}
            selected={teamType}
            onChange={setTeamType}
          />
        </div>
        <button onClick={close} className="text-zinc-400 hover:text-white text-xl leading-none">
          ✕
        </button>
      </div>

      <PlayerListAndUrl players={players} onToggle={togglePlayer} />

      <div className="mt-4 space-y-3">
        {teamType === "enemy" && (
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="チーム名"
            className="w-full bg-zinc-800 border border-zinc-600 text-white rounded px-3 py-2 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleRegister()
            }}
          />
        )}
        <div className="flex items-center gap-3">
          <button onClick={() => void handleRegister()} className="bg-green-700 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded text-sm">
            登録
          </button>
          {msg && <span className="text-sm text-red-400">{msg}</span>}
        </div>
      </div>
    </div>
  )
}
