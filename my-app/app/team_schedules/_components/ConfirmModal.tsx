"use client"

import { useState } from "react"

type ConfirmModalProps = {
  title: string
  /** 操作の説明文（実行後にどうなるかを明記する） */
  description: string
  /** 確定ボタンのラベル */
  confirmLabel: string
  /** 確定処理。成功すると自動でモーダルを閉じる。失敗時は例外を投げるとエラー表示して開いたまま */
  onConfirm: () => Promise<void>
  onClose: () => void
}

/**
 * 単純な確認モーダル（はい/いいえ）。
 * 取り返しのつく操作（ログアウト等）向け。データを失う操作は入力確認付きの ConfirmByTypingModal を使う。
 */
export function ConfirmModal({ title, description, confirmLabel, onConfirm, onClose }: ConfirmModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "処理に失敗しました")
      setSubmitting(false)
    }
  }

  return (
    <div className="w-[min(92vw,420px)] rounded-xl border border-zinc-700 bg-zinc-900 p-6 text-zinc-100 shadow-xl">
      <h2 className="text-base font-bold text-zinc-100">{title}</h2>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-300">{description}</p>

      {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={submitting} className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50">
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "処理中…" : confirmLabel}
        </button>
      </div>
    </div>
  )
}
