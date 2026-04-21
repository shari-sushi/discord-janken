"use client"

import { OpenInNew } from "@/app/_client/components/OpenInNew"
import { buildPlayerUrl } from "@/app/_client/lib/op-gg/url"
import type { Player } from "../_types"

export function PlayerCheckboxList({ players, onToggle }: { players: Player[]; onToggle: (i: number) => void }) {
  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
      {players.map((player, i) => (
        <div key={i} className="flex items-center gap-1.5 bg-zinc-700 rounded-b-sm px-1 py-0.5 hover:bg-zinc-600">
          <label className="flex items-center gap-1.5 flex-1 cursor-pointer min-w-0">
            <input type="checkbox" checked={player.checked} onChange={() => onToggle(i)} className="w-4 h-4 rounded accent-blue-500 cursor-pointer shrink-0" />
            <span className={`truncate ${player.checked ? "text-white" : "text-zinc-500 line-through"}`}>
              {player.name}
            </span>
          </label>
          <a href={buildPlayerUrl(player.name)} target="_blank" rel="noopener noreferrer" title="op.gg で個別に開く">
            <OpenInNew className="hover:fill-blue-400" />
          </a>
        </div>
      ))}
    </div>
  )
}
