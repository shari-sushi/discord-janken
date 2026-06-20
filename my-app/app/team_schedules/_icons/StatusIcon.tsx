import type { ReactElement } from "react"
import type { CellStatus } from "../_types"

/**
 * Material Symbols 由来のアイコン群。
 * - ok    → circle（○の代替・アウトライン丸）
 * - maybe → change_history（△の代替）
 * - ng    → dangerous（×の代替）
 * none は専用アイコンを持たない（呼び出し側で "–" を表示する）。
 * ok の circle 図形は「活動可」バッジでも使うため CircleIcon として別途エクスポートする。
 */
const PATHS: Partial<Record<CellStatus, string>> = {
  ok: "M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z",
  maybe: "m80-160 400-640 400 640H80Zm144-80h512L480-650 224-240Zm256-205Z",
  ng: "M330-120 120-330v-300l210-210h300l210 210v300L630-120H330Zm36-190 114-114 114 114 56-56-114-114 114-114-56-56-114 114-114-114-56 56 114 114-114 114 56 56Zm-2 110h232l164-164v-232L596-760H364L200-596v232l164 164Zm116-280Z",
}

function Icon({ d, className }: { d: string; className: string }): ReactElement {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden className={className}>
      <path d={d} />
    </svg>
  )
}

type StatusIconProps = {
  status: CellStatus
  className?: string
}

/** 出欠ステータスのアイコン（○△×）。専用アイコンを持たない status では null を返す */
export function StatusIcon({ status, className }: StatusIconProps) {
  const d = PATHS[status]
  if (!d) return null
  return <Icon d={d} className={"fill-white " + (className ?? "h-4 w-4")} />
}

/** 丸（○）アイコン。「活動可」バッジで使う。fill は呼び出し側で指定する（未指定は fill-current） */
export function CircleIcon({ className }: { className?: string }) {
  return <Icon d={PATHS.ok!} className={className ?? "h-4 w-4 fill-current"} />
}

/** 説明文に混ぜるインラインアイコン（文字サイズに追従し、セルと同じステータス色で塗る） */
const INLINE_FILL: Partial<Record<CellStatus, string>> = {
  ok: "fill-emerald-500",
  maybe: "fill-amber-400",
  ng: "fill-rose-400",
}
export function InlineStatusIcon({ status }: { status: CellStatus }) {
  const d = PATHS[status]
  if (!d) return null
  return <Icon d={d} className={`inline-block h-[1em] w-[1em] align-text-bottom ${INLINE_FILL[status] ?? "fill-current"}`} />
}
