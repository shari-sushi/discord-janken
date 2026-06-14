"use client"

import { useState } from "react"

type Status = "idle" | "checking" | "ok" | "error"

/**
 * DB疎通チェック用の極小ボタン。
 * 画面右下に常駐。通常はほぼ透明で、hoverで色が出る。未ログインでも使える。
 * クリックで /api/web/health/db を GET し、成否（ok）をドット色で表示するだけ。
 * driver/host/latency などの詳細はサーバーログ側に出る。
 */
export function DbHealthButton() {
  const [status, setStatus] = useState<Status>("idle")

  const check = async () => {
    setStatus("checking")
    try {
      const res = await fetch("/api/web/health/db", { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      setStatus(res.ok && data.ok ? "ok" : "error")
    } catch {
      setStatus("error")
    }
  }

  const dotColor =
    status === "ok"
      ? "bg-emerald-500"
      : status === "error"
        ? "bg-rose-500"
        : status === "checking"
          ? "bg-amber-400"
          : "bg-zinc-600"

  const label = status === "ok" ? "DB OK" : status === "error" ? "DB NG" : status === "checking" ? "確認中" : ""

  return (
    <button
      type="button"
      onClick={() => void check()}
      title="DB疎通チェック"
      aria-label="DB疎通チェック"
      className="fixed bottom-2 right-2 z-50 flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] text-zinc-300 opacity-15 transition hover:opacity-100"
    >
      <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
      {label && <span>{label}</span>}
    </button>
  )
}
