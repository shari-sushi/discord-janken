"use client"

import type { Player } from "../_types"
import { buildMultiUrl, buildPlayerUrl } from "../_utils"
import { CopyButton } from "./CopyButton"

export function PlayerListAndUrl({
  players,
  onToggle,
  onOpenRegister,
}: {
  players: Player[]
  onToggle: (i: number) => void
  onOpenRegister?: () => void
}) {
  const checkedPlayers = players.filter((p) => p.checked)
  const multiUrl = buildMultiUrl(checkedPlayers.map((p) => p.name))

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {players.map((player, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="checkbox" id={`player-${i}`} checked={player.checked} onChange={() => onToggle(i)} className="w-4 h-4 rounded accent-blue-500 cursor-pointer" />
            <label htmlFor={`player-${i}`} className={`flex-1 cursor-pointer ${player.checked ? "text-white" : "text-zinc-500 line-through"}`}>
              {player.name}
            </label>
            <a href={buildPlayerUrl(player.name)} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-blue-400 text-sm" title="op.gg で個別に開く">
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
            <a href={multiUrl} target="_blank" rel="noopener noreferrer" className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-2 rounded text-sm">
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
            {onOpenRegister && (
              <button onClick={onOpenRegister} className="bg-green-700 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded text-sm">
                チーム登録
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-500">※ 全タブを一括で開くとブラウザのポップアップブロッカーが作動する場合があります。その場合はブラウザの許可設定を確認してください。</p>
        </div>
      )}
    </div>
  )
}
