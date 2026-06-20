import type { ReactElement } from "react"

/**
 * たたむ/開くアイコン。Material Symbols の expand_less / expand_more（シェブロン）由来。
 * - collapsed=false（展開中）: 上向き（クリックでたたむ）
 * - collapsed=true（たたみ中）: 下向き（クリックで開く）
 * fill は呼び出し側で指定する（未指定は fill-current）。
 */
const EXPAND_LESS_PATH = "M480-528 296-344l-56-56 240-240 240 240-56 56-184-184Z" // 上向きシェブロン
const EXPAND_MORE_PATH = "M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z" // 下向きシェブロン

export function CollapseIcon({ collapsed, className }: { collapsed: boolean; className?: string }): ReactElement {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden className={className ?? "h-5 w-5 fill-current"}>
      <path d={collapsed ? EXPAND_MORE_PATH : EXPAND_LESS_PATH} />
    </svg>
  )
}
