"use client"

import { useState } from "react"

type InviteModalProps = {
  url: string
  expiryDays: number
  onClose: () => void
}

/** 発行済みの招待リンクを表示し、コピーできるモーダル */
export function InviteModal({ url, expiryDays, onClose }: InviteModalProps) {
  const [copied, setCopied] = useState(false)

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
    <div className="w-[min(92vw,460px)] rounded-xl bg-white p-6 text-slate-800 shadow-xl">
      <h2 className="text-base font-bold text-slate-900">招待リンク</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        このリンクを渡すと、ログインした人がこのチームに参加できます。
      </p>

      <div className="mt-3 flex items-stretch gap-2">
        <input readOnly value={url} className="min-w-0 flex-1 rounded border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700" />
        <button type="button" onClick={handleCopy} className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
          {copied ? "コピーしました" : "コピー"}
        </button>
      </div>

      {expiryDays > 0 && <p className="mt-2 text-xs text-slate-400">※ 有効期限: {expiryDays}日</p>}

      <div className="mt-5 flex justify-end">
        <button type="button" onClick={onClose} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
          閉じる
        </button>
      </div>
    </div>
  )
}
