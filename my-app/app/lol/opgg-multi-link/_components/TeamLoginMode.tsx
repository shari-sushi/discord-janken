"use client"

import { useState, useMemo } from "react"
import type { EnemyTeam } from "@/app/_domains/lol/types"
import { fetchTeams, updateTeam, removeMember } from "@/app/_domains/lol/_client/opggApiClient"
import { validateRiotId } from "@/app/_domains/lol/riotId"
import { PlayerListAndUrl } from "./PlayerListAndUrl"

export function TeamLoginMode({
  teams,
  myTeamName,
  onMyTeamNameChange,
  onTeamsChange,
  onSwitchToInput,
  selectQuery,
  onSelectQueryChange,
  selectSelected,
  onSelectSelectedChange,
  selectConfirmed,
  onSelectConfirmedChange,
}: {
  teams: EnemyTeam[]
  myTeamName: string
  onMyTeamNameChange: (name: string) => void
  onTeamsChange: (teams: EnemyTeam[]) => void
  onSwitchToInput: () => void
  selectQuery: string
  onSelectQueryChange: (q: string) => void
  selectSelected: EnemyTeam | null
  onSelectSelectedChange: (t: EnemyTeam | null) => void
  selectConfirmed: boolean
  onSelectConfirmedChange: (v: boolean) => void
}) {
  const myTeam = teams.find((t) => t.name === myTeamName) ?? null

  if (myTeam) {
    return (
      <TeamManageView
        myTeam={myTeam}
        onMyTeamNameChange={onMyTeamNameChange}
        onTeamsChange={onTeamsChange}
      />
    )
  }

  return (
    <TeamSelectForm
      teams={teams}
      myTeamName={myTeamName}
      onMyTeamNameChange={onMyTeamNameChange}
      onSwitchToInput={onSwitchToInput}
      query={selectQuery}
      onQueryChange={onSelectQueryChange}
      selected={selectSelected}
      onSelectedChange={onSelectSelectedChange}
      confirmed={selectConfirmed}
      onConfirmedChange={onSelectConfirmedChange}
    />
  )
}

// 自チーム設定済み時の管理UI。myTeam が確定している前提で mount されるため
// useState の初期値を myTeam から安全に取れる。
function TeamManageView({
  myTeam,
  onMyTeamNameChange,
  onTeamsChange,
}: {
  myTeam: EnemyTeam
  onMyTeamNameChange: (name: string) => void
  onTeamsChange: (teams: EnemyTeam[]) => void
}) {
  // チェック外しを追跡するセット（デフォルト全員チェック済み）
  const [uncheckedMembers, setUncheckedMembers] = useState<Set<string>>(new Set())
  const [addMemberInput, setAddMemberInput] = useState("")
  const [renameInput, setRenameInput] = useState(myTeam.name)
  const [actionMsg, setActionMsg] = useState("")
  const [removingMember, setRemovingMember] = useState<string | null>(null)
  const [isAddingMember, setIsAddingMember] = useState(false)

  const players = useMemo(
    () => myTeam.members.map((name) => ({ name, checked: !uncheckedMembers.has(name) })),
    [myTeam.members, uncheckedMembers],
  )

  const showMsg = (msg: string) => {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(""), 2500)
  }

  const refreshTeams = async () => {
    const updated = await fetchTeams()
    onTeamsChange(updated)
  }

  const handleAddMember = async () => {
    const member = addMemberInput.trim()
    if (!member) return
    const validation = validateRiotId(member)
    if (!validation.valid) {
      showMsg(validation.error)
      return
    }
    if (myTeam.members.includes(member)) {
      showMsg("すでに登録されているメンバーです")
      return
    }
    setIsAddingMember(true)
    try {
      await updateTeam(myTeam.name, { members: [...myTeam.members, member] })
      await refreshTeams()
      setAddMemberInput("")
      showMsg("追加しました")
    } catch (e) {
      showMsg(`エラー: ${e instanceof Error ? e.message : "不明"}`)
    } finally {
      setIsAddingMember(false)
    }
  }

  const handleRemoveMember = async (member: string) => {
    setRemovingMember(member)
    try {
      await removeMember(myTeam.name, member)
      await refreshTeams()
      showMsg(`${member} を除名しました`)
    } catch (e) {
      showMsg(`エラー: ${e instanceof Error ? e.message : "不明"}`)
    } finally {
      setRemovingMember(null)
    }
  }

  const handleRenameTeam = async () => {
    const newName = renameInput.trim()
    if (!newName || newName === myTeam.name) return
    try {
      await updateTeam(myTeam.name, { name: newName })
      await refreshTeams()
      onMyTeamNameChange(newName)
      showMsg("チーム名を変更しました")
    } catch (e) {
      showMsg(`エラー: ${e instanceof Error ? e.message : "不明"}`)
    }
  }

  const togglePlayer = (i: number) => {
    const member = players[i]?.name
    if (!member) return
    setUncheckedMembers((prev) => {
      const next = new Set(prev)
      if (next.has(member)) {
        next.delete(member)
      } else {
        next.add(member)
      }
      return next
    })
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-zinc-300">
          自チーム: <span className="text-white">{myTeam.name}</span>
        </h2>
        <button onClick={() => onMyTeamNameChange("")} className="text-xs text-zinc-400 hover:text-zinc-200 underline">
          設定解除
        </button>
      </div>

      {/* メンバー管理 */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-300">メンバー管理</h3>

        {/* メンバーリスト + 除名ボタン */}
        <div className="space-y-1">
          {myTeam.members.map((member) => (
            <div key={member} className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5">
              <span className="flex-1 text-sm text-white">{member}</span>
              <button
                onClick={() => void handleRemoveMember(member)}
                disabled={removingMember !== null}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-0.5 rounded hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {removingMember === member ? "除名中…" : "除名"}
              </button>
            </div>
          ))}
        </div>

        {/* メンバー追加 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={addMemberInput}
            onChange={(e) => setAddMemberInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleAddMember()
            }}
            placeholder="追加するメンバー名"
            className="flex-1 bg-zinc-800 border border-zinc-600 text-white rounded px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => void handleAddMember()}
            disabled={isAddingMember}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-3 py-1.5 rounded"
          >
            {isAddingMember ? "追加中…" : "追加"}
          </button>
        </div>

        {/* チーム名変更 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={renameInput}
            onChange={(e) => setRenameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleRenameTeam()
            }}
            placeholder="新しいチーム名"
            className="flex-1 bg-zinc-800 border border-zinc-600 text-white rounded px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => void handleRenameTeam()}
            disabled={!renameInput.trim() || renameInput.trim() === myTeam.name}
            className="bg-zinc-600 hover:bg-zinc-500 disabled:opacity-40 text-white text-sm font-semibold px-3 py-1.5 rounded"
          >
            チーム名変更
          </button>
        </div>

        {actionMsg && <p className="text-xs text-zinc-400">{actionMsg}</p>}
      </div>

      {/* op.gg URL生成（TeamSearchMode と同じUI） */}
      {players.length > 0 && (
        <div>
          <p className="text-sm text-zinc-400 mb-2">
            選択: <span className="text-white font-semibold">{myTeam.name}</span>
          </p>
          <PlayerListAndUrl players={players} onToggle={togglePlayer} />
        </div>
      )}
    </div>
  )
}

function TeamSelectForm({
  teams,
  myTeamName,
  onMyTeamNameChange,
  onSwitchToInput,
  query,
  onQueryChange,
  selected,
  onSelectedChange,
  confirmed,
  onConfirmedChange,
}: {
  teams: EnemyTeam[]
  myTeamName: string
  onMyTeamNameChange: (name: string) => void
  onSwitchToInput: () => void
  query: string
  onQueryChange: (q: string) => void
  selected: EnemyTeam | null
  onSelectedChange: (t: EnemyTeam | null) => void
  confirmed: boolean
  onConfirmedChange: (v: boolean) => void
}) {
  const filtered = teams.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))

  const handleSelect = (team: EnemyTeam) => {
    onSelectedChange(team)
    onQueryChange(team.name)
    onConfirmedChange(false)
  }

  const handleConfirm = () => {
    if (!selected) return
    onMyTeamNameChange(selected.name)
    onConfirmedChange(true)
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
            onQueryChange(e.target.value)
            onSelectedChange(null)
            onConfirmedChange(false)
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
