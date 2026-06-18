"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"

type ScrollFadeRowProps = {
  /** 横スクロールさせたい中身。フレックス等で w-max にしておくとはみ出し分がスクロールできる */
  children: ReactNode
  className?: string
}

/**
 * 横スクロール可能な行に、まだスクロールできる側だけ白いフェードを重ねるラッパー。
 * - 右にスクロール余地があれば右端、左に戻せれば左端に出す（端まで来た側は消す）。
 * - フェードは中央へ向かうほど透明になる白のグラデーション。
 * - pointer-events-none なので下のボタン等のタップ/クリックは妨げない。
 */
export function ScrollFadeRow({ children, className }: ScrollFadeRowProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    // 端の判定は誤差吸収のため 1px の余裕を見る
    setCanLeft(el.scrollLeft > 1)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    update()
    el.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    // 子要素の増減（ボタンの出し入れ）で幅が変わるケースにも追従する
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
      ro.disconnect()
    }
  }, [update])

  return (
    <div className="relative min-w-0 max-w-full">
      <div ref={ref} className={"overflow-x-auto overflow-y-hidden " + (className ?? "")}>
        {children}
      </div>
      {/* 左端フェード（左に戻せるときだけ）。左端で白→中央へ透明 */}
      <div
        aria-hidden
        className={"pointer-events-none absolute inset-y-0 left-0 w-8 bg-linear-to-r from-white/45 to-transparent transition-opacity " + (canLeft ? "opacity-100" : "opacity-0")}
      />
      {/* 右端フェード（右にスクロール余地があるときだけ）。右端で白→中央へ透明 */}
      <div
        aria-hidden
        className={"pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-white/45 to-transparent transition-opacity " + (canRight ? "opacity-100" : "opacity-0")}
      />
    </div>
  )
}
