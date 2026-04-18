"use client"

import { useState } from "react"
import { useOverlay } from "@/app/_client/lib/modal/ModalContext"
import { WEBHOOK_STORAGE_KEY } from "@/app/_client/lib/discord/webhook"

export function DiscordWebhookOverlay({ onConfirm }: { onConfirm: (url: string) => void }) {
  const { close } = useOverlay()
  const [url, setUrl] = useState(() => localStorage.getItem(WEBHOOK_STORAGE_KEY) ?? "")
  const [error, setError] = useState("")

  const handleSave = () => {
    const trimmed = url.trim()
    if (!trimmed.startsWith("https://discord.com/api/webhooks/")) {
      setError("Discord Webhook URL を入力してください（https://discord.com/api/webhooks/... の形式）")
      return
    }
    localStorage.setItem(WEBHOOK_STORAGE_KEY, trimmed)
    onConfirm(trimmed)
    close()
  }

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-120 max-w-[90vw] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Discord Webhook URL</h2>
        <button onClick={close} className="text-zinc-400 hover:text-white text-xl leading-none">
          ✕
        </button>
      </div>

      <p className="text-sm text-zinc-400 mb-3">Discord のサーバー設定から Webhook URL を取得して入力してください。</p>

      <div className="bg-blue-950 border border-blue-800 rounded p-3 mb-4 text-xs text-blue-300">
        🔒 この URL はブラウザの LocalStorage にのみ保存されます。サーバーには送信されません。
      </div>

      <input
        type="url"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value)
          setError("")
        }}
        placeholder="https://discord.com/api/webhooks/..."
        className="w-full bg-zinc-800 border border-zinc-600 text-white rounded px-3 py-2 text-sm mb-3"
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave()
        }}
        autoFocus
      />

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      <div className="flex gap-2">
        <button onClick={handleSave} className="bg-indigo-700 hover:bg-indigo-600 text-white font-semibold px-4 py-2 rounded text-sm">
          保存して送る
        </button>
        <button onClick={close} className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-4 py-2 rounded text-sm">
          キャンセル
        </button>
      </div>
    </div>
  )
}
