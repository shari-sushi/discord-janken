"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { TabSelector } from "@/app/_client/components/TabSelector"
import type { EnemyTeam } from "@/app/_domains/lol/types"
import { fetchTeams } from "@/app/_domains/lol/_client/opggApiClient"
import type { Mode, Player } from "../_types"
import { InputMode } from "./InputMode"
import { TeamSearchMode } from "./TeamSearchMode"
import { TeamLoginMode } from "./TeamLoginMode"

const MY_TEAM_NAME_KEY = "lol-my-team-name"

const MODES = [
  { id: "input" as Mode, label: "入力モード" },
  { id: "team-search" as Mode, label: "チーム検索" },
  { id: "my-team" as Mode, label: "自チーム設定" },
]

export function OpggMultiLinkPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [mode, setMode] = useState<Mode>(() => {
    const m = searchParams.get("mode")
    if (m === "team-search" || m === "my-team") return m
    return "input"
  })
  const [myTeamName, setMyTeamName] = useState(() => {
    if (typeof window === "undefined") return ""
    return localStorage.getItem(MY_TEAM_NAME_KEY) ?? ""
  })
  const [teams, setTeams] = useState<EnemyTeam[]>([])

  // InputMode の state
  const [inputText, setInputText] = useState("")
  const [inputPlayers, setInputPlayers] = useState<Player[]>([])
  const [inputExcludeSelf, setInputExcludeSelf] = useState(true)

  // TeamSearchMode の state
  const [searchQuery, setSearchQuery] = useState("")
  const [searchSelected, setSearchSelected] = useState<EnemyTeam | null>(null)
  const [searchPlayers, setSearchPlayers] = useState<Player[]>([])

  // TeamLoginMode > TeamSelectForm の state
  const [selectQuery, setSelectQuery] = useState("")
  const [selectSelected, setSelectSelected] = useState<EnemyTeam | null>(null)
  const [selectConfirmed, setSelectConfirmed] = useState(false)

  // チーム一覧をロード
  useEffect(() => {
    void fetchTeams()
      .then(setTeams)
      .catch(() => {})
  }, [])

  const handleMyTeamNameChange = (name: string) => {
    setMyTeamName(name)
    localStorage.setItem(MY_TEAM_NAME_KEY, name)
  }

  const selfTeam = teams.find((t) => t.name === myTeamName)?.members ?? []

  const handleModeChange = (m: Mode) => {
    setMode(m)
    router.replace(`?mode=${m}`, { scroll: false })
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold">op.gg マルチサーチリンク生成</h1>
        <TabSelector tabs={MODES} selected={mode} onChange={handleModeChange} />
      </div>

      {/* 2カラムグリッド */}
      <div className="grid grid-cols-1 gap-8">
        {/* メインコンテンツ */}
        <div>
          {mode === "input" && (
            <InputMode
              selfTeam={selfTeam}
              onTeamsChange={setTeams}
              onMyTeamNameChange={handleMyTeamNameChange}
              text={inputText}
              onTextChange={setInputText}
              players={inputPlayers}
              onPlayersChange={setInputPlayers}
              excludeSelf={inputExcludeSelf}
              onExcludeSelfChange={setInputExcludeSelf}
            />
          )}
          {mode === "team-search" && (
            <TeamSearchMode
              teams={teams}
              query={searchQuery}
              onQueryChange={setSearchQuery}
              selected={searchSelected}
              onSelectedChange={setSearchSelected}
              players={searchPlayers}
              onPlayersChange={setSearchPlayers}
            />
          )}
          {mode === "my-team" && (
            <TeamLoginMode
              teams={teams}
              myTeamName={myTeamName}
              onMyTeamNameChange={handleMyTeamNameChange}
              onTeamsChange={setTeams}
              onSwitchToInput={() => handleModeChange("input")}
              selectQuery={selectQuery}
              onSelectQueryChange={setSelectQuery}
              selectSelected={selectSelected}
              onSelectSelectedChange={setSelectSelected}
              selectConfirmed={selectConfirmed}
              onSelectConfirmedChange={setSelectConfirmed}
            />
          )}
        </div>
      </div>
    </div>
  )
}
