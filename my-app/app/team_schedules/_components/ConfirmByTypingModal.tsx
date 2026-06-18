"use client"

import { useState } from "react"

type ConfirmByTypingModalProps = {
  title: string
  /** 操作の説明文（取り返しのつかなさ等を明記する） */
  description: string
  /** 確定するために入力させる語（例: "脱退" / "削除"） */
  confirmWord: string
  /** 確定ボタンのラベル */
  confirmLabel: string
  /** 確定処理。成功すると自動でモーダルを閉じる。失敗時は例外を投げるとエラー表示して開いたまま */
  onConfirm: () => Promise<void>
  onClose: () => void
  /**
   * 指定すると、入力欄・確定ボタンの代わりにこの案内文を表示して操作自体をブロックする。
   * （例: master 権限を持っているため、先に移譲が必要なケース）
   */
  blockedReason?: string
}

/**
 * 取り返しのつかない操作（脱退・アカウント削除など）の確認モーダル。
 * 指定語（confirmWord）を正確に入力するまで確定ボタン（alert色）を押せない。
 * blockedReason が渡された場合は、入力欄・確定ボタンを出さず案内文のみ表示する。
 */
export function ConfirmByTypingModal({ title, description, confirmWord, confirmLabel, onConfirm, onClose, blockedReason }: ConfirmByTypingModalProps) {
  const [input, setInput] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canConfirm = input === confirmWord && !submitting

  const handleConfirm = async () => {
    if (!canConfirm) return
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

  // ブロック時: 入力・確定は出さず、理由を表示して「閉じる」だけにする
  if (blockedReason) {
    return (
      <div className="w-[min(92vw,420px)] rounded-xl border border-zinc-700 bg-zinc-900 p-6 text-zinc-100 shadow-xl">
        <h2 className="text-base font-bold text-rose-300">{title}</h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-zinc-300">{blockedReason}</p>
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800">
            閉じる
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-[min(92vw,420px)] rounded-xl border border-zinc-700 bg-zinc-900 p-6 text-zinc-100 shadow-xl">
      <h2 className="text-base font-bold text-rose-300">{title}</h2>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-300">{description}</p>

      <label className="mt-4 block text-sm">
        <span className="text-zinc-400">
          確認のため <span className="font-bold text-rose-300">{confirmWord}</span> と入力してください
        </span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={submitting}
          autoComplete="off"
          className="mt-2 w-full rounded border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-zinc-100 focus:border-rose-400 focus:outline-none disabled:opacity-50"
        />
      </label>

      {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={submitting} className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50">
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "処理中…" : confirmLabel}
        </button>
      </div>
    </div>
  )
}
