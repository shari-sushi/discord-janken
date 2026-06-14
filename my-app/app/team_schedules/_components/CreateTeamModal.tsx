"use client"

import { useState } from "react"
import type { TeamManagementMode, TeamSummary } from "@/app/_domains/teamSchedules/types"
import { createTeam } from "@/app/_domains/teamSchedules/_client/teamSchedulesApiClient"

type CreateTeamModalProps = {
  onClose: () => void
  onCreated: (team: TeamSummary) => void
}

/** チームを新規作成するフォームモーダル（作成権限を持つユーザーのみ開ける） */
export function CreateTeamModal({ onClose, onCreated }: CreateTeamModalProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [mode, setMode] = useState<TeamManagementMode>("members")
  const [requiredCount, setRequiredCount] = useState(5)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = name.trim().length >= 1 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const team = await createTeam({
        name: name.trim(),
        description: description.trim() || null,
        managementMode: mode,
        // team モードでは required_count を使わないが、スキーマ制約（>=1）のため 1 を送る
        requiredCount: mode === "members" ? requiredCount : 1,
      })
      onCreated(team)
    } catch (e) {
      setError(e instanceof Error ? e.message : "チームの作成に失敗しました")
      setSubmitting(false)
    }
  }

  return (
    <div className="w-[min(92vw,440px)] rounded-xl border border-zinc-700 bg-zinc-900 p-6 text-zinc-100 shadow-xl">
      <h2 className="text-base font-bold text-zinc-100">チームを作成</h2>

      <div className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-300">チーム名</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            placeholder="例: ○○サークル Aチーム"
            className="rounded border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-400 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-300">説明（任意）</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            className="rounded border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-400 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-300">活動可否の管理方法</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as TeamManagementMode)}
            className="rounded border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-zinc-100 focus:border-indigo-400 focus:outline-none"
          >
            <option value="members">メンバー集計（各自が予定を入力）</option>
            <option value="team">チーム単位（管理者がまとめて入力）</option>
          </select>
        </label>

        {mode === "members" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-300">成立に必要な人数</span>
            <input
              type="number"
              min={1}
              value={requiredCount}
              onChange={(e) => setRequiredCount(Math.max(1, Number(e.target.value) || 1))}
              className="w-24 rounded border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-400 focus:outline-none"
            />
          </label>
        )}
      </div>

      {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800">
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "作成中…" : "作成する"}
        </button>
      </div>
    </div>
  )
}
