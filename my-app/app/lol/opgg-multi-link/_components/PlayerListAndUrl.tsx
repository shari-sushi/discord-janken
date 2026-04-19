"use client"

import { useState } from "react"
import { useOverlay } from "@/app/_client/lib/modal/ModalContext"
import { WEBHOOK_STORAGE_KEY, sendWebhookMessage } from "@/app/_client/lib/discord/webhook"
import type { Player } from "../_types"
import { buildMultiUrl, buildPlayerUrl } from "@/app/_client/lib/op-gg/url"
import { CopyButton } from "./CopyButton"
import { DiscordWebhookOverlay } from "./DiscordWebhookOverlay"
import { PlayerCheckboxList } from "./PlayerCheckboxList"

export function PlayerListAndUrl({ players, onToggle, onOpenRegister }: { players: Player[]; onToggle: (i: number) => void; onOpenRegister?: () => void }) {
  const checkedPlayers = players.filter((p) => p.checked)
  const multiUrl = buildMultiUrl(checkedPlayers.map((p) => p.name))
  const { open } = useOverlay()
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "done" | "error">("idle")

  const buildDiscordMessage = () => {
    const multiLine = `- [マルチサーチ：${checkedPlayers.length}人](${multiUrl})`
    const individualLinks = checkedPlayers.map((p) => `[${p.name}](${buildPlayerUrl(p.name)})`).join("、")
    const individualLine = `- 個別ページ：${individualLinks}`
    return `${multiLine}\n${individualLine}`
  }

  const sendToDiscord = async (webhookUrl: string) => {
    setSendStatus("sending")
    try {
      await sendWebhookMessage(webhookUrl, { content: buildDiscordMessage() })
      setSendStatus("done")
      setTimeout(() => setSendStatus("idle"), 3000)
    } catch {
      setSendStatus("error")
      setTimeout(() => setSendStatus("idle"), 3000)
    }
  }

  const handleSendToDiscord = () => {
    const savedUrl = localStorage.getItem(WEBHOOK_STORAGE_KEY)
    if (savedUrl) {
      void sendToDiscord(savedUrl)
    } else {
      open(<DiscordWebhookOverlay onConfirm={(url) => void sendToDiscord(url)} />)
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <PlayerCheckboxList players={players} onToggle={onToggle} />

      {checkedPlayers.length > 0 && (
        <div className="space-y-3">
          <div className="bg-zinc-800 border border-zinc-600 rounded p-3 flex items-start gap-2">
            <span className="text-xs text-zinc-300 break-all flex-1 font-mono">{multiUrl}</span>
            <CopyButton text={multiUrl} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <a href={multiUrl} target="_blank" rel="noopener noreferrer" className="bg-zinc-700 hover:bg-zinc-600 text-white font-semibold px-4 py-2 rounded text-sm">
              OP.GGマルチサーチを開く
            </a>
            <button
              onClick={() => {
                for (const p of checkedPlayers) {
                  window.open(buildPlayerUrl(p.name), "_blank", "noopener,noreferrer")
                }
              }}
              className="bg-zinc-700 hover:bg-zinc-600 text-white font-semibold px-4 py-2 rounded text-sm"
            >
              OP.GGを個別に開く
            </button>
            {onOpenRegister && (
              <button onClick={onOpenRegister} className="bg-green-700 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded text-sm">
                チーム登録
              </button>
            )}
            <button
              onClick={handleSendToDiscord}
              disabled={sendStatus === "sending"}
              className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded text-sm"
            >
              {sendStatus === "sending" ? "送信中..." : sendStatus === "done" ? "送信完了!" : sendStatus === "error" ? "送信失敗" : "Discordへ送る"}
            </button>
          </div>
          <p className="text-xs text-zinc-500">※ 全タブを一括で開くとブラウザのポップアップブロッカーが作動する場合があります。その場合はブラウザの許可設定を確認してください。</p>
        </div>
      )}
    </div>
  )
}
