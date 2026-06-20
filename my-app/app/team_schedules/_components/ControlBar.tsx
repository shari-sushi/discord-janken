"use client"

import { REQUIRED_COUNT_LABEL, type TeamManagementMode } from "@/app/_domains/teamSchedules/types"
import { STATUS_STYLE } from "../_utils"
import type { CellStatus } from "../_types"

type ControlBarProps = {
  threshold: number
  managementMode: TeamManagementMode
}

const LEGEND: CellStatus[] = ["ok", "maybe", "ng", "none"]

/** 凡例と現在の必要人数を表示するバー（必要人数の変更はチーム設定側の責務） */
export function ControlBar({ threshold, managementMode }: ControlBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900 md:px-3 px-2 py-2.5 text-sm">
      {/* 活動可能人数は members モードでのみ意味を持つため、team モードでは凡例から非表示にする（#153） */}
      {managementMode !== "team" && (
        <span className="text-zinc-300">
          {REQUIRED_COUNT_LABEL}：<span className="font-bold text-zinc-100">{threshold}人</span>
        </span>
      )}
      <div className="ml-auto flex flex-wrap items-center  md:gap-x-2 gap-x-1 text-xs text-zinc-400">
        {LEGEND.map((s) => {
          const style = STATUS_STYLE[s]
          return (
            <span key={s} className="flex items-center md:gap-2 gap-0.5">
              <span className={"inline-flex h-3 md:w-3.5 w-3 items-center justify-center rounded-full align-middle text-[9px] " + style.className}>{style.symbol}</span>
              {style.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
