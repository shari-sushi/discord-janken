import type { ReactElement } from "react"

/**
 * 閉じる（×）アイコン。Material Symbols の close 由来。
 * fill は呼び出し側で指定する（未指定は fill-current）。
 */
const CLOSE_PATH =
  "m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"

export function CloseIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden className={className ?? "h-4 w-4 fill-current"}>
      <path d={CLOSE_PATH} />
    </svg>
  )
}
