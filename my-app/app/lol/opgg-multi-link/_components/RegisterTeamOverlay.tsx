"use client"

import { useState } from "react"
import { useOverlay } from "@/app/_client/lib/modal/ModalContext"
import type { EnemyTeam } from "@/app/_domains/lol/types"
import { saveTeam, fetchTeams } from "@/app/_domains/lol/_client/opggApiClient"
import type { Player } from "../_types"
import { PlayerCheckboxList } from "./PlayerCheckboxList"
import { InfoPopup } from "@/app/_client/components/InfoPopup"

export function RegisterTeamOverlay({
  initialPlayers,
  onTeamsSaved,
  onMyTeamNameChange,
  onPlayersChange,
}: {
  initialPlayers: Player[]
  onTeamsSaved: (teams: EnemyTeam[]) => void
  onMyTeamNameChange: (name: string) => void
  onPlayersChange?: (players: Player[]) => void
}) {
  const { close } = useOverlay()
  const [players, setPlayers] = useState<Player[]>(initialPlayers)
  const [teamName, setTeamName] = useState("")
  const [isMyTeam, setIsMyTeam] = useState(false)
  const [msg, setMsg] = useState("")

  const togglePlayer = (i: number) => {
    const updated = players.map((p, idx) => (idx === i ? { ...p, checked: !p.checked } : p))
    setPlayers(updated)
    onPlayersChange?.(updated)
  }

  const handleRegister = async () => {
    setMsg("")
    const members = players.filter((p) => p.checked).map((p) => p.name)
    if (members.length === 0) {
      setMsg("メンバーを1人以上選択してください")
      return
    }
    if (!teamName.trim()) {
      setMsg("チーム名を入力してください")
      return
    }
    try {
      await saveTeam({ name: teamName.trim(), members })
      const updated = await fetchTeams()
      onTeamsSaved(updated)
      if (isMyTeam) {
        onMyTeamNameChange(teamName.trim())
      }
      close()
    } catch (e) {
      setMsg(`エラー: ${e instanceof Error ? e.message : "不明"}`)
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-[98svw] md:w-[90svw] h-160 p-5 overflow-y-auto space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">チーム登録</h2>
        <button onClick={close} className="text-zinc-400 hover:text-white text-xl leading-none">
          ✕
        </button>
      </div>
      <input
        className="w-full bg-zinc-800 border border-zinc-600 text-white rounded px-3 py-2 text-sm"
        type="text"
        value={teamName}
        onChange={(e) => setTeamName(e.target.value)}
        placeholder="チーム名"
        onKeyDown={(e) => {
          if (e.key === "Enter") void handleRegister()
        }}
      />
      <PlayerCheckboxList players={players} onToggle={togglePlayer} idPrefix="overlay-player" />

      <div className="mt-4 space-y-3">
        <div className="flex justify-end items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <InfoPopup message="チェックを入れると、自分のチームはop.ggリンク生成時に自動で除外されるようになります。設定から変更できます。">
              <input type="checkbox" checked={isMyTeam} onChange={(e) => setIsMyTeam(e.target.checked)} className="accent-blue-500" />
            </InfoPopup>
            自分のチーム？
          </label>
          <button onClick={() => void handleRegister()} className="bg-green-700 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded text-sm">
            登録
          </button>
          {msg && <span className="text-sm text-red-400">{msg}</span>}
        </div>
      </div>
    </div>
  )
}
