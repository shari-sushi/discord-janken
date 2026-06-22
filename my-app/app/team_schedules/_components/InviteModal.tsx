"use client"

import { useState } from "react"

type InviteModalProps = {
  url: string
  expiryDays: number
  /** リンクの用途。invite=チーム参加（既定） / share=スケジュール相互共有（#175）。見出し・説明文だけ切り替える */
  variant?: "invite" | "share"
  onClose: () => void
}

/** 発行済みの招待／共有リンクを表示し、コピーできるモーダル */
export function InviteModal({ url, expiryDays, variant = "invite", onClose }: InviteModalProps) {
  const [copied, setCopied] = useState(false)
  const isShare = variant === "share"
  const title = isShare ? "スケジュール共有リンク" : "招待リンク"
  const description = isShare
    ? "このリンクを相手チームの管理者に渡すと、リンクを踏んで承認した時点で互いのスケジュールを共有できます。"
    : "このリンクを渡すと、ログインした人がこのチームに参加できます。"

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // クリップボードが使えない環境では何もしない（手動コピーできる）
    }
  }

  return (
    <div className="w-[min(92vw,460px)] rounded-xl border border-zinc-700 bg-zinc-900 p-6 text-zinc-100 shadow-xl">
      <h2 className="text-base font-bold text-zinc-100">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-300">{description}</p>

      <div className="mt-3 flex items-stretch gap-2">
        <input readOnly value={url} className="min-w-0 flex-1 rounded border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200" />
        <button type="button" onClick={handleCopy} className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
          {copied ? "コピーしました" : "コピー"}
        </button>
      </div>

      {expiryDays > 0 && <p className="mt-2 text-xs text-zinc-400">※ 有効期限: {expiryDays}日</p>}

      <div className="mt-5 flex justify-end">
        <button type="button" onClick={onClose} className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-600">
          閉じる
        </button>
      </div>
    </div>
  )
}
