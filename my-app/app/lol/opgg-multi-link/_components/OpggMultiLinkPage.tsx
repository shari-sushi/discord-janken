"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { TabSelector } from "@/app/_client/components/TabSelector"
import type { EnemyTeam } from "@/app/domains/lol/types"
import { fetchSelfTeam, fetchEnemyTeams } from "@/app/domains/lol/_client/opggApiClient"
import type { Mode } from "../_types"
import { buildBasicAuth } from "../_utils"
import { InputMode } from "./InputMode"
import { TeamSearchMode } from "./TeamSearchMode"
import { TeamLoginMode } from "./TeamLoginMode"
import { SettingsSection } from "./SettingsSection"

const MODES = [
  { id: "input" as Mode, label: "入力モード" },
  { id: "team-search" as Mode, label: "チーム検索" },
  { id: "team-login" as Mode, label: "チームログイン" },
]

export function OpggMultiLinkPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [mode, setMode] = useState<Mode>(() => {
    const m = searchParams.get("mode")
    if (m === "team-search" || m === "team-login") return m
    return "input"
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [auth, setAuth] = useState("")
  const [selfTeam, setSelfTeam] = useState<string[]>([])
  const [enemyTeams, setEnemyTeams] = useState<EnemyTeam[]>([])

  // 保存済み認証情報で自動ロード
  useEffect(() => {
    const username = localStorage.getItem("lol-opgg-username")
    const password = localStorage.getItem("lol-opgg-password")
    if (!username || !password) return

    const a = buildBasicAuth(username, password)
    void Promise.all([fetchSelfTeam(a), fetchEnemyTeams(a)])
      .then(([st, et]) => {
        setAuth(a)
        setSelfTeam(st)
        setEnemyTeams(et)
      })
      .catch(() => {
        // 認証失敗は無視（設定セクションで再ログインを促す）
        localStorage.removeItem("lol-opgg-username")
        localStorage.removeItem("lol-opgg-password")
      })
  }, [])

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
          {mode === "input" && <InputMode selfTeam={selfTeam} auth={auth} onEnemyTeamsChange={setEnemyTeams} onSelfTeamChange={setSelfTeam} />}
          {mode === "team-search" && <TeamSearchMode enemyTeams={enemyTeams} />}
          {mode === "team-login" && <TeamLoginMode enemyTeams={enemyTeams} selfTeam={selfTeam} onSelfTeamChange={setSelfTeam} onSwitchToInput={() => handleModeChange("input")} />}
        </div>

        {/* 設定セクション */}
        <div className="border border-zinc-700 rounded-lg self-start">
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <span>⚙ 設定</span>
            <span className="text-zinc-500">{settingsOpen ? "▲" : "▼"}</span>
          </button>
          {settingsOpen && (
            <div className="px-4 pb-4 border-t border-zinc-700">
              <div className="pt-4">
                <SettingsSection auth={auth} selfTeam={selfTeam} enemyTeams={enemyTeams} onAuthChange={setAuth} onSelfTeamChange={setSelfTeam} onEnemyTeamsChange={setEnemyTeams} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
