"use client"

import { useState } from "react"
import { DEFAULT_REQUIRED_COUNT, MIN_REQUIRED_COUNT, REQUIRED_COUNT_LABEL, type TeamManagementMode, type TeamSummary } from "@/app/_domains/teamSchedules/types"
import { createTeam } from "@/app/_domains/teamSchedules/_client/teamSchedulesApiClient"

type CreateTeamFormProps = {
  onCreated: (team: TeamSummary) => void
  /** 渡すとキャンセルボタンを表示する（単体モーダルでは閉じる用、管理モーダルのタブでは省略） */
  onCancel?: () => void
  /** 入力・作成ボタンを無効化する（未ログイン時に値だけ見せて操作させない用途） */
  disabled?: boolean
}

/** チーム新規作成フォーム（単体モーダルと管理モーダルのタブで共有） */
export function CreateTeamForm({ onCreated, onCancel, disabled = false }: CreateTeamFormProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [mode, setMode] = useState<TeamManagementMode>("members")
  const [requiredCount, setRequiredCount] = useState(DEFAULT_REQUIRED_COUNT)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = !disabled && name.trim().length >= 1 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const team = await createTeam({
        name: name.trim(),
        description: description.trim() || null,
        managementMode: mode,
        // team モードでは required_count を使わないが、スキーマ制約（>= 最小値）のため最小値を送る
        requiredCount: mode === "members" ? requiredCount : MIN_REQUIRED_COUNT,
      })
      onCreated(team)
    } catch (e) {
      setError(e instanceof Error ? e.message : "チームの作成に失敗しました")
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-300">新規で登録するチーム名</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={disabled}
            maxLength={50}
            placeholder="例: ○○サークル Aチーム"
            className="rounded border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-400 focus:outline-none disabled:opacity-50"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-300">説明（任意）</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={disabled}
            maxLength={200}
            className="rounded border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-400 focus:outline-none disabled:opacity-50"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-300">活動可否の管理方法</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as TeamManagementMode)}
            disabled={disabled}
            className="rounded border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-zinc-100 focus:border-indigo-400 focus:outline-none disabled:opacity-50"
          >
            <option value="members">メンバー集計（各自が予定を入力）</option>
            <option value="team">チーム単位（管理者がまとめて入力）</option>
          </select>
        </label>

        {mode === "members" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-300">{REQUIRED_COUNT_LABEL}</span>
            <input
              type="number"
              min={MIN_REQUIRED_COUNT}
              value={requiredCount}
              onChange={(e) => setRequiredCount(Math.max(MIN_REQUIRED_COUNT, Number(e.target.value) || MIN_REQUIRED_COUNT))}
              disabled={disabled}
              className="w-24 rounded border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-400 focus:outline-none disabled:opacity-50"
            />
          </label>
        )}
      </div>

      {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800">
            キャンセル
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "作成中…" : "作成する"}
        </button>
      </div>
    </>
  )
}
