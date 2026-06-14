"use client"

import { STATUS_STYLE } from "../_utils"
import type { CellStatus } from "../_types"

type ControlBarProps = {
  threshold: number
}

const LEGEND: CellStatus[] = ["ok", "maybe", "ng", "none"]

/** 凡例と現在の必要人数を表示するバー（必要人数の変更はチーム設定側の責務） */
export function ControlBar({ threshold }: ControlBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
      <span className="text-slate-600">
        成立に必要な人数：<span className="font-bold text-slate-900">{threshold}人</span>
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2.5 text-xs text-slate-500">
        {LEGEND.map((s) => {
          const style = STATUS_STYLE[s]
          return (
            <span key={s} className="flex items-center gap-1">
              <span className={"inline-flex h-3.5 w-3.5 items-center justify-center rounded-full align-middle text-[9px] " + style.className}>{style.symbol}</span>
              {style.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
