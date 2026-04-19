"use client"

import { useState, useEffect } from "react"
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
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [authError, setAuthError] = useState("")
  const [selfTeamText, setSelfTeamText] = useState(selfTeam.join("\n"))
  const [selfTeamMsg, setSelfTeamMsg] = useState("")
  const [newTeamName, setNewTeamName] = useState("")
  const [newTeamMembers, setNewTeamMembers] = useState("")
  const [enemyTeamMsg, setEnemyTeamMsg] = useState("")

  useEffect(() => {
    setSelfTeamText(selfTeam.join("\n"))
  }, [selfTeam])

  const handleLogin = async () => {
    setAuthError("")
    const a = buildBasicAuth(username, password)
    try {
      await fetchSelfTeam(a)
      onAuthChange(a)
      const [st, et] = await Promise.all([fetchSelfTeam(a), fetchEnemyTeams(a)])
      onSelfTeamChange(st)
      onEnemyTeamsChange(et)
      localStorage.setItem("lol-opgg-username", username)
      localStorage.setItem("lol-opgg-password", password)
    } catch {
      setAuthError("認証失敗。ユーザー名・パスワードを確認してください。")
    }
  }

  const handleSaveSelfTeam = async () => {
    setSelfTeamMsg("")
    const members = selfTeamText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    try {
      await saveSelfTeam(auth, members)
      onSelfTeamChange(members)
      setSelfTeamMsg("保存しました")
      setTimeout(() => setSelfTeamMsg(""), 2000)
    } catch (e) {
      setSelfTeamMsg(`エラー: ${e instanceof Error ? e.message : "不明"}`)
    }
  }

  const handleAddEnemyTeam = async () => {
    setEnemyTeamMsg("")
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
      setEnemyTeamMsg("保存しました")
      setTimeout(() => setEnemyTeamMsg(""), 2000)
    } catch (e) {
      setEnemyTeamMsg(`エラー: ${e instanceof Error ? e.message : "不明"}`)
    }
  }

  const handleDeleteEnemyTeam = async (name: string) => {
    setEnemyTeamMsg("")
    try {
      await deleteTeam(name)
      onTeamsChange(teams.filter((t) => t.name !== name))
      if (myTeamName === name) {
        onMyTeamNameChange("")
      }
    } catch (e) {
      setEnemyTeamMsg(`エラー: ${e instanceof Error ? e.message : "不明"}`)
    }
  }

  if (!auth) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-400">設定の保存・読み込みにはログインが必要です。</p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ユーザー名"
            className="bg-zinc-800 border border-zinc-600 text-white rounded px-3 py-1.5 text-sm w-40"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード"
            className="bg-zinc-800 border border-zinc-600 text-white rounded px-3 py-1.5 text-sm w-40"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleLogin()
            }}
          />
          <button onClick={() => void handleLogin()} className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-1.5 rounded text-sm">
            ログイン
          </button>
        </div>
        {authError && <p className="text-red-400 text-sm">{authError}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 自チームメンバー */}
      <div>
        <h3 className="font-semibold mb-2 text-sm text-zinc-300">自チームメンバー登録</h3>
        <p className="text-xs text-zinc-500 mb-2">入力モードで解析時に自動除外されます（1行1人）</p>
        <textarea
          className="w-full bg-zinc-800 border border-zinc-600 text-white rounded px-3 py-2 h-28 resize-y text-sm"
          value={selfTeamText}
          onChange={(e) => setSelfTeamText(e.target.value)}
          placeholder={"player1\nplayer2\nplayer3"}
        />
        <div className="flex items-center gap-3 mt-2">
          <button onClick={() => void handleSaveSelfTeam()} className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-1.5 rounded text-sm">
            保存
          </button>
          {selfTeamMsg && <span className="text-sm text-zinc-400">{selfTeamMsg}</span>}
        </div>
      </div>

      {/* 相手チーム一覧 */}
      <div>
        <h3 className="font-semibold mb-2 text-sm text-zinc-300">相手チーム登録</h3>

        {/* 既存チーム一覧 */}
        {enemyTeams.length > 0 && (
          <div className="mb-4 space-y-2">
            {enemyTeams.map((team) => (
              <div key={team.name} className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded px-3 py-2">
                <span className="flex-1 text-sm">
                  <span className="font-semibold text-white">{team.name}</span>
                  <span className="ml-2 text-zinc-400 text-xs">({team.members.length}人)</span>
                </span>
                <button onClick={() => void handleDeleteEnemyTeam(team.name)} className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-zinc-700">
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
            <button onClick={() => void handleAddEnemyTeam()} className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-1.5 rounded text-sm">
              追加・更新
            </button>
            {enemyTeamMsg && <span className="text-sm text-zinc-400">{enemyTeamMsg}</span>}
          </div>
        </div>
      </div>

      <button
        onClick={() => {
          localStorage.removeItem("lol-opgg-username")
          localStorage.removeItem("lol-opgg-password")
          onAuthChange("")
        }}
        className="text-xs text-zinc-500 hover:text-zinc-300"
      >
        ログアウト
      </button>
    </div>
  )
}
