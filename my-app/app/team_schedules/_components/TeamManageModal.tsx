"use client"

import { useState } from "react"
import type { TeamManagementMode, TeamSchedule } from "@/app/_domains/teamSchedules/types"
import { updateTeam } from "@/app/_domains/teamSchedules/_client/teamSchedulesApiClient"

type TeamManageModalProps = {
  team: TeamSchedule
  /**
   * UI の表示制御専用（保存ボタンを出すか・招待セクションを出すか）。
   * 実際の編集権限はサーバーの PATCH 側で必ず判定する（UI を隠すだけにしない二重防御）。
   */
  isAdmin: boolean
  onClose: () => void
  /** 保存成功時に親へ通知（親は再取得して最新化する） */
  onUpdated: () => void
}

const MODE_LABEL: Record<TeamManagementMode, string> = {
  members: "メンバー集計（各自が予定を入力）",
  team: "チーム単位（管理者がまとめて入力）",
}

/** 準備中のセクション枠（未実装項目の見出しだけ先に置く） */
function ComingSoonSection({ title }: { title: string }) {
  return (
    <section className="border-t border-zinc-800 pt-4">
      <h3 className="text-sm font-bold text-zinc-300">{title}</h3>
      <p className="mt-1 text-xs text-zinc-500">準備中</p>
    </section>
  )
}

/**
 * チーム管理画面（#126 第1弾）。
 * メンバーなら開けるが、編集できるのは admin 相当以上。
 * 今回機能があるのは「管理モード変更」のみで、他項目は準備中プレースホルダ。
 * md 以下は body 全体を覆う実質ページ、lg 以上は中央カード。
 */
export function TeamManageModal({ team, isAdmin, onClose, onUpdated }: TeamManageModalProps) {
  const [mode, setMode] = useState<TeamManagementMode>(team.managementMode)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = mode !== team.managementMode
  const canSubmit = isAdmin && dirty && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await updateTeam(team.teamId, { managementMode: mode })
      onUpdated()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "チームの更新に失敗しました")
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-dvh w-screen flex-col overflow-y-auto rounded-none border-0 bg-zinc-900 p-6 text-zinc-100 shadow-xl md:h-auto md:max-h-[85vh] md:w-[min(92vw,480px)] md:rounded-xl md:border md:border-zinc-700">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-bold text-zinc-100">チーム管理</h2>
          <p className="mt-0.5 text-sm text-zinc-400">{team.name}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="閉じる" className="rounded-lg px-2 py-1 text-lg leading-none text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
          ×
        </button>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {/* チーム名変更（準備中） */}
        <ComingSoonSection title="チーム名変更" />

        {/* 管理モード変更（機能あり） */}
        <section className="border-t border-zinc-800 pt-4">
          <h3 className="text-sm font-bold text-zinc-300">活動可否の管理方法</h3>
          {isAdmin ? (
            <>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as TeamManagementMode)}
                disabled={submitting}
                className="mt-2 w-full rounded border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-indigo-400 focus:outline-none disabled:opacity-50"
              >
                <option value="members">{MODE_LABEL.members}</option>
                <option value="team">{MODE_LABEL.team}</option>
              </select>
              {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "保存中…" : "保存する"}
                </button>
              </div>
            </>
          ) : (
            // メンバー（非 admin）は読み取り専用
            <p className="mt-2 text-sm text-zinc-200">{MODE_LABEL[team.managementMode]}</p>
          )}
        </section>

        {/* メンバー管理（準備中） */}
        <ComingSoonSection title="メンバー管理" />

        {/* 招待リンク管理（準備中）。メンバーは招待リンクを見られないため admin のみ表示 */}
        {isAdmin && <ComingSoonSection title="招待リンク管理" />}
      </div>
    </div>
  )
}
