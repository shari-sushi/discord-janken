"use client"

import { useState } from "react"
import type { EnemyTeam } from "@/app/_domains/lol/types"
import { fetchTeams, saveTeam, deleteTeam } from "@/app/_domains/lol/_client/opggApiClient"

export function SettingsSection({
  myTeamName,
  teams,
  onMyTeamNameChange,
  onTeamsChange,
}: {
  myTeamName: string
  teams: EnemyTeam[]
  onMyTeamNameChange: (name: string) => void
  onTeamsChange: (teams: EnemyTeam[]) => void
}) {
  const [newTeamName, setNewTeamName] = useState("")
  const [newTeamMembers, setNewTeamMembers] = useState("")
  const [teamMsg, setTeamMsg] = useState("")

  const handleAddTeam = async () => {
    setTeamMsg("")
    const members = newTeamMembers
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    if (!newTeamName.trim()) {
      setTeamMsg("チーム名を入力してください")
      return
    }
    if (members.length === 0) {
      setTeamMsg("メンバーを入力してください")
      return
    }
    try {
      await saveTeam({ name: newTeamName.trim(), members })
      const updated = await fetchTeams()
      onTeamsChange(updated)
      setNewTeamName("")
      setNewTeamMembers("")
      setTeamMsg("保存しました")
      setTimeout(() => setTeamMsg(""), 2000)
    } catch (e) {
      setTeamMsg(`エラー: ${e instanceof Error ? e.message : "不明"}`)
    }
  }

  const handleDeleteTeam = async (name: string) => {
    setTeamMsg("")
    try {
      await deleteTeam(name)
      onTeamsChange(teams.filter((t) => t.name !== name))
      if (myTeamName === name) {
        onMyTeamNameChange("")
      }
    } catch (e) {
      setTeamMsg(`エラー: ${e instanceof Error ? e.message : "不明"}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* チーム一覧 */}
      <div>
        <h3 className="font-semibold mb-2 text-sm text-zinc-300">登録チーム</h3>

        {teams.length > 0 && (
          <div className="mb-4 space-y-2">
            {teams.map((team) => (
              <div key={team.name} className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded px-3 py-2">
                <span className="flex-1 text-sm">
                  <span className="font-semibold text-white">{team.name}</span>
                  <span className="ml-2 text-zinc-400 text-xs">({team.members.length}人)</span>
                  {myTeamName === team.name && <span className="ml-2 text-blue-400 text-xs">自チーム</span>}
                </span>
                <button
                  onClick={() => onMyTeamNameChange(myTeamName === team.name ? "" : team.name)}
                  className={`text-xs px-2 py-1 rounded ${myTeamName === team.name ? "text-blue-300 bg-blue-900/40 hover:bg-blue-900/60" : "text-zinc-400 hover:text-blue-300 hover:bg-zinc-700"}`}
                >
                  {myTeamName === team.name ? "自チーム解除" : "自チームに設定"}
                </button>
                <button onClick={() => void handleDeleteTeam(team.name)} className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-zinc-700">
                  削除
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 新規チーム追加 */}
        <div className="space-y-2">
          <input
            type="text"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="チーム名"
            className="w-full bg-zinc-800 border border-zinc-600 text-white rounded px-3 py-2 text-sm"
          />
          <textarea
            className="w-full bg-zinc-800 border border-zinc-600 text-white rounded px-3 py-2 h-28 resize-y text-sm"
            value={newTeamMembers}
            onChange={(e) => setNewTeamMembers(e.target.value)}
            placeholder={"player1\nplayer2\nplayer3\nplayer4\nplayer5"}
          />
          <div className="flex items-center gap-3">
            <button onClick={() => void handleAddTeam()} className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-1.5 rounded text-sm">
              追加・更新
            </button>
            {teamMsg && <span className="text-sm text-zinc-400">{teamMsg}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
