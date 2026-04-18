"use client"

import { useState } from "react"

function buildBasicAuth(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`
}

export function LoginPromptCard({ onLogin }: { onLogin: (auth: string) => void }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleLogin = async () => {
    setError("")
    const auth = buildBasicAuth(username, password)
    const res = await fetch("/api/web/lol/opgg/self-team", { headers: { Authorization: auth } })
    const json = (await res.json()) as { success: boolean }
    if (!json.success) {
      setError("認証失敗。ユーザー名・パスワードを確認してください。")
      return
    }
    localStorage.setItem("lol-opgg-username", username)
    localStorage.setItem("lol-opgg-password", password)
    onLogin(auth)
  }

  return (
    <div className="bg-zinc-800 border border-zinc-600 rounded p-4 space-y-3">
      <p className="text-sm text-zinc-300">自分のチームへの登録にはログインが必要です</p>
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="ユーザー名"
          className="bg-zinc-700 border border-zinc-500 text-white rounded px-3 py-1.5 text-sm w-36"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワード"
          className="bg-zinc-700 border border-zinc-500 text-white rounded px-3 py-1.5 text-sm w-36"
          onKeyDown={(e) => { if (e.key === "Enter") void handleLogin() }}
        />
        <button
          onClick={() => void handleLogin()}
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-1.5 rounded text-sm"
        >
          ログイン
        </button>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}
