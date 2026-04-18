"use client"

import { Suspense, useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"

// ---- 型定義 ----

type EnemyTeam = { name: string; members: string[] }
type Player = { name: string; checked: boolean }
type Mode = "input" | "team-search"

// ---- ユーティリティ ----

function parseLine(line: string): string {
  const trimmed = line.trim()
  // ロビーログ形式: 「XXX さんが部屋に参加しました。」
  const m = trimmed.match(/^(.+?) さんが部屋に参加しました。$/)
  if (m) return m[1]
  // Discord形式: @Name#TAG
  if (trimmed.startsWith("@")) return trimmed.slice(1)
  return trimmed
}

function parseInput(text: string): string[] {
  return text
    .split(/[\n ]/)
    .map(parseLine)
    .filter((n) => n.length > 0)
}

function buildMultiUrl(names: string[]): string {
  return `https://op.gg/ja/lol/multisearch/jp?summoners=${names.map((n) => encodeURIComponent(n)).join(",")}`
}

function buildPlayerUrl(name: string): string {
  return `https://op.gg/ja/lol/summoners/jp/${name.replace("#", "-")}`
}

function buildBasicAuth(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`
}

// ---- API ----

const API_SELF_TEAM = "/api/web/lol/opgg/self-team"
const API_ENEMY_TEAMS = "/api/web/lol/opgg/enemy-teams"

async function fetchSelfTeam(auth: string): Promise<string[]> {
  const res = await fetch(API_SELF_TEAM, { headers: { Authorization: auth } })
  const json = (await res.json()) as { success: boolean; members?: string[]; error?: string }
  if (!json.success) throw new Error(json.error ?? "取得失敗")
  return json.members ?? []
}

async function saveSelfTeam(auth: string, members: string[]): Promise<void> {
  const res = await fetch(API_SELF_TEAM, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({ members }),
  })
  const json = (await res.json()) as { success: boolean; error?: string }
  if (!json.success) throw new Error(json.error ?? "保存失敗")
}

async function fetchEnemyTeams(auth: string): Promise<EnemyTeam[]> {
  const res = await fetch(API_ENEMY_TEAMS, { headers: { Authorization: auth } })
  const json = (await res.json()) as { success: boolean; teams?: EnemyTeam[]; error?: string }
  if (!json.success) throw new Error(json.error ?? "取得失敗")
  return json.teams ?? []
}

async function saveEnemyTeam(auth: string, team: EnemyTeam): Promise<void> {
  const res = await fetch(API_ENEMY_TEAMS, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify(team),
  })
  const json = (await res.json()) as { success: boolean; error?: string }
  if (!json.success) throw new Error(json.error ?? "保存失敗")
}

async function deleteEnemyTeam(auth: string, name: string): Promise<void> {
  const res = await fetch(API_ENEMY_TEAMS, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({ name }),
  })
  const json = (await res.json()) as { success: boolean; error?: string }
  if (!json.success) throw new Error(json.error ?? "削除失敗")
}

// ---- コンポーネント: プレイヤーリスト + URL表示 ----

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handle = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [text])
  return (
    <button
      onClick={handle}
      className="shrink-0 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-3 py-1 rounded"
    >
      {copied ? "コピーしました" : "コピー"}
    </button>
  )
}

function PlayerListAndUrl({ players, onToggle }: { players: Player[]; onToggle: (i: number) => void }) {
  const checkedPlayers = players.filter((p) => p.checked)
  const multiUrl = buildMultiUrl(checkedPlayers.map((p) => p.name))

  return (
    <div className="mt-4 space-y-4">
      <div className="space-y-1">
        {players.map((player, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`player-${i}`}
              checked={player.checked}
              onChange={() => onToggle(i)}
              className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
            />
            <label
              htmlFor={`player-${i}`}
              className={`flex-1 cursor-pointer ${player.checked ? "text-white" : "text-zinc-500 line-through"}`}
            >
              {player.name}
            </label>
            <a
              href={buildPlayerUrl(player.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-blue-400 text-sm"
              title="op.gg で個別に開く"
            >
              🔗
            </a>
          </div>
        ))}
      </div>

      {checkedPlayers.length > 0 && (
        <div className="space-y-3">
          <div className="bg-zinc-800 border border-zinc-600 rounded p-3 flex items-start gap-2">
            <span className="text-xs text-zinc-300 break-all flex-1 font-mono">{multiUrl}</span>
            <CopyButton text={multiUrl} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <a
              href={multiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-2 rounded text-sm"
            >
              マルチ検索を開く
            </a>
            <button
              onClick={() => {
                for (const p of checkedPlayers) {
                  window.open(buildPlayerUrl(p.name), "_blank", "noopener,noreferrer")
                }
              }}
              className="bg-zinc-700 hover:bg-zinc-600 text-white font-semibold px-4 py-2 rounded text-sm"
            >
              全タブを開く
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            ※ 全タブを一括で開くとブラウザのポップアップブロッカーが作動する場合があります。その場合はブラウザの許可設定を確認してください。
          </p>
        </div>
      )}
    </div>
  )
}

// ---- 入力モード ----

function InputMode({ selfTeam }: { selfTeam: string[] }) {
  const [text, setText] = useState("")
  const [players, setPlayers] = useState<Player[]>([])

  const handleAnalyze = () => {
    const parsed = parseInput(text)
    const selfSet = new Set(selfTeam.map((s) => s.toLowerCase()))
    const filtered = parsed.filter((name) => !selfSet.has(name.toLowerCase()))
    setPlayers(filtered.map((name) => ({ name, checked: true })))
  }

  const togglePlayer = (i: number) => {
    setPlayers((prev) => prev.map((p, idx) => (idx === i ? { ...p, checked: !p.checked } : p)))
  }

  return (
    <div>
      <div className="mb-4">
        <label className="block mb-2 font-semibold text-sm text-zinc-300">
          ロビーログ / Discord メンション / プレーンテキストを貼り付け
        </label>
        <textarea
          className="w-full bg-zinc-800 border border-zinc-600 text-white rounded px-3 py-2 h-40 resize-y text-sm"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"ROX Smeb さんが部屋に参加しました。\n@Name#TAG\nplayer3"}
        />
      </div>
      <button
        onClick={handleAnalyze}
        disabled={!text.trim()}
        className="bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2 rounded"
      >
        解析・除外
      </button>
      {selfTeam.length > 0 && (
        <span className="ml-3 text-xs text-zinc-500">自チーム {selfTeam.length} 人を除外します</span>
      )}
      {players.length > 0 && <PlayerListAndUrl players={players} onToggle={togglePlayer} />}
    </div>
  )
}

// ---- チーム検索モード ----

function TeamSearchMode({ enemyTeams }: { enemyTeams: EnemyTeam[] }) {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<EnemyTeam | null>(null)
  const [players, setPlayers] = useState<Player[]>([])

  const filtered = enemyTeams.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))

  const handleSelect = (team: EnemyTeam) => {
    setSelected(team)
    setPlayers(team.members.map((name) => ({ name, checked: true })))
    setQuery(team.name)
  }

  const togglePlayer = (i: number) => {
    setPlayers((prev) => prev.map((p, idx) => (idx === i ? { ...p, checked: !p.checked } : p)))
  }

  return (
    <div>
      <div className="mb-4">
        <label className="block mb-2 font-semibold text-sm text-zinc-300">チーム名を検索</label>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelected(null)
            setPlayers([])
          }}
          placeholder="チーム名を入力..."
          className="w-full bg-zinc-800 border border-zinc-600 text-white rounded px-3 py-2"
        />
      </div>

      {!selected && query.length > 0 && filtered.length > 0 && (
        <div className="mb-4 border border-zinc-600 rounded overflow-hidden">
          {filtered.map((team) => (
            <button
              key={team.name}
              onClick={() => handleSelect(team)}
              className="w-full text-left px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border-b border-zinc-700 last:border-b-0 text-sm"
            >
              <span className="font-semibold text-white">{team.name}</span>
              <span className="ml-2 text-zinc-400">({team.members.length}人)</span>
            </button>
          ))}
        </div>
      )}

      {!selected && query.length > 0 && filtered.length === 0 && (
        <p className="text-zinc-500 text-sm mb-4">「{query}」に一致するチームが見つかりません</p>
      )}

      {enemyTeams.length === 0 && (
        <p className="text-zinc-500 text-sm mb-4">相手チームが登録されていません。設定から登録してください。</p>
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

// ---- 設定セクション ----

function SettingsSection({
  auth,
  selfTeam,
  enemyTeams,
  onAuthChange,
  onSelfTeamChange,
  onEnemyTeamsChange,
}: {
  auth: string
  selfTeam: string[]
  enemyTeams: EnemyTeam[]
  onAuthChange: (auth: string) => void
  onSelfTeamChange: (members: string[]) => void
  onEnemyTeamsChange: (teams: EnemyTeam[]) => void
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
      // localStorageに保存
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
      setEnemyTeamMsg("チーム名を入力してください")
      return
    }
    if (members.length === 0) {
      setEnemyTeamMsg("メンバーを入力してください")
      return
    }
    try {
      await saveEnemyTeam(auth, { name: newTeamName.trim(), members })
      const updated = await fetchEnemyTeams(auth)
      onEnemyTeamsChange(updated)
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
      await deleteEnemyTeam(auth, name)
      onEnemyTeamsChange(enemyTeams.filter((t) => t.name !== name))
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
          <button
            onClick={() => void handleLogin()}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-1.5 rounded text-sm"
          >
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
          <button
            onClick={() => void handleSaveSelfTeam()}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-1.5 rounded text-sm"
          >
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
                <button
                  onClick={() => void handleDeleteEnemyTeam(team.name)}
                  className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-zinc-700"
                >
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
            <button
              onClick={() => void handleAddEnemyTeam()}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-1.5 rounded text-sm"
            >
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

// ---- メインコンポーネント ----

const MODES = [
  { id: "input" as Mode, label: "入力モード" },
  { id: "team-search" as Mode, label: "チーム検索" },
]

function OpggMultiLinkPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [mode, setMode] = useState<Mode>(() => {
    const m = searchParams.get("mode")
    return m === "team-search" ? "team-search" : "input"
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
    <div className="p-8 max-w-3xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold">op.gg マルチサーチリンク生成</h1>
        <div className="flex items-center gap-1 rounded-lg bg-zinc-800 p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => handleModeChange(m.id)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                mode === m.id ? "bg-zinc-600 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* メインコンテンツ */}
      {mode === "input" && <InputMode selfTeam={selfTeam} />}
      {mode === "team-search" && <TeamSearchMode enemyTeams={enemyTeams} />}

      {/* 設定セクション */}
      <div className="mt-10 border border-zinc-700 rounded-lg">
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
              <SettingsSection
                auth={auth}
                selfTeam={selfTeam}
                enemyTeams={enemyTeams}
                onAuthChange={setAuth}
                onSelfTeamChange={setSelfTeam}
                onEnemyTeamsChange={setEnemyTeams}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function OpggMultiLinkPageWrapper() {
  return (
    <Suspense>
      <OpggMultiLinkPage />
    </Suspense>
  )
}
