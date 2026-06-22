"use client"

import { useState } from "react"
import type { SharePreview } from "@/app/_domains/teamSchedules/types"

type ShareAcceptModalProps = {
  preview: SharePreview
  /** 受諾処理。自分の所属チーム（acceptTeamId）と発行元チームを共有する。成功で自動的に閉じる */
  onAccept: (acceptTeamId: string) => Promise<void>
  onClose: () => void
}

/**
 * 共有リンク着地時の確認モーダル（#175）。
 * 発行元チームと、受諾者の所属チーム（admin 以上）を相互共有してよいか確認する。
 * 共有は対称かつ非推移であることを図で説明する。
 */
export function ShareAcceptModal({ preview, onAccept, onClose }: ShareAcceptModalProps) {
  const { sourceTeam, acceptCandidates } = preview
  // 候補が1件なら自動選択、複数なら最初を初期選択、0件は空（受諾不可）
  const [acceptTeamId, setAcceptTeamId] = useState<string>(acceptCandidates[0]?.teamId ?? "")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const noCandidate = acceptCandidates.length === 0

  const handleAccept = async () => {
    if (submitting || !acceptTeamId) return
    setSubmitting(true)
    setError(null)
    try {
      await onAccept(acceptTeamId)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "共有の開始に失敗しました")
      setSubmitting(false)
    }
  }

  return (
    <div className="w-[min(92vw,460px)] rounded-xl border border-zinc-700 bg-zinc-900 p-6 text-zinc-100 shadow-xl">
      <h2 className="text-base font-bold text-zinc-100">スケジュールを共有しますか？</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-300">
        チーム「{sourceTeam.name}」と、互いの活動可能日を共有します。共有すると、両チームの管理者・メンバーが相手のスケジュールを閲覧できるようになります。
      </p>

      {/* 共有は対称かつ非推移であることの説明＋図 */}
      <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3 text-xs leading-relaxed text-zinc-400">
        <div className="flex items-center justify-center gap-1 py-1 font-mono text-sm text-zinc-300" aria-hidden>
          <span className="rounded bg-zinc-700 px-1.5 py-0.5">A</span>
          <span className="text-emerald-400">↔</span>
          <span className="rounded bg-zinc-700 px-1.5 py-0.5">B</span>
          <span className="text-emerald-400">↔</span>
          <span className="rounded bg-zinc-700 px-1.5 py-0.5">C</span>
        </div>
        <p className="mt-2">
          共有は<span className="text-zinc-200">相手ごとに個別</span>です。A–B と B–C を共有しても、<span className="text-zinc-200">A と C は共有されません</span>（A から C のスケジュールは見えません）。
        </p>
        <p className="mt-1.5">2チーム目以降は、チーム設定からいつでも追加で共有できます。</p>
      </div>

      {noCandidate ? (
        <p className="mt-4 rounded-lg border border-amber-700 bg-amber-950/40 px-3 py-2 text-xs text-amber-300">
          共有を結べるチームがありません。共有するには、あなたが管理者（master / admin）のチームが必要です。
        </p>
      ) : acceptCandidates.length === 1 ? (
        <p className="mt-4 text-sm text-zinc-300">
          あなたのチーム「{acceptCandidates[0].name}」と共有します。
        </p>
      ) : (
        <label className="mt-4 block text-sm">
          <span className="text-zinc-400">共有する自分のチーム</span>
          <select
            value={acceptTeamId}
            onChange={(e) => setAcceptTeamId(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 font-medium text-zinc-100 focus:border-indigo-400 focus:outline-none"
          >
            {acceptCandidates.map((t) => (
              <option key={t.teamId} value={t.teamId}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={submitting} className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50">
          {noCandidate ? "閉じる" : "キャンセル"}
        </button>
        {!noCandidate && (
          <button
            type="button"
            onClick={handleAccept}
            disabled={submitting || !acceptTeamId}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "処理中…" : "共有する"}
          </button>
        )}
      </div>
    </div>
  )
}
