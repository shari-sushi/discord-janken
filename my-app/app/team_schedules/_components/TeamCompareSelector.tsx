"use client"

import { useEffect, useRef, useState } from "react"
import type { TeamSummary } from "@/app/_domains/teamSchedules/types"
import { DimOverlay } from "./DimOverlay"

type TeamCompareSelectorProps = {
  teams: TeamSummary[];
  ownTeamId: string | null;
  opponentTeamIds: string[];
  onOwnTeamChange: (teamId: string | null) => void;
  onOpponentsChange: (teamIds: string[]) => void;
};

/** ラベル列の幅（自チーム / 相手チームで揃える。「相手チーム」4文字が収まる幅） */
const LABEL_WIDTH = "w-16"

/** 比較するチーム（自チーム + 相手チーム複数）を選ぶ in-page セレクタ */
export function TeamCompareSelector({
  teams,
  ownTeamId,
  opponentTeamIds,
  onOwnTeamChange,
  onOpponentsChange,
}: TeamCompareSelectorProps) {
  const toggleOpponent = (teamId: string) => {
    if (opponentTeamIds.includes(teamId)) {
      onOpponentsChange(opponentTeamIds.filter((id) => id !== teamId))
    } else {
      onOpponentsChange([...opponentTeamIds, teamId])
    }
  }

  // 自チームは「自分が所属しているチーム」だけから選べる（相手チームは全チームが候補）
  const ownTeamCandidates = teams.filter((t) => t.isMember)

  // 自チームに選ばれているチームは相手候補から除外
  const opponentCandidates = teams.filter((t) => t.teamId !== ownTeamId)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm">
      {/* md未満: 自作ドロップダウン（下向きに展開・幅いっぱい） */}
      <div className="flex items-center gap-2 md:hidden">
        <span
          className={LABEL_WIDTH + " shrink-0 whitespace-nowrap text-zinc-400"}
        >
          自チーム
        </span>
        <OwnTeamDropdown
          teams={ownTeamCandidates}
          ownTeamId={ownTeamId}
          onChange={onOwnTeamChange}
          className="min-w-0 flex-1"
        />
      </div>

      {/* md以上: ネイティブ select（従来表示） */}
      <label className="hidden items-center gap-2 md:flex">
        <span
          className={LABEL_WIDTH + " shrink-0 whitespace-nowrap text-zinc-400"}
        >
          自チーム
        </span>
        <select
          value={ownTeamId ?? ""}
          onChange={(e) => onOwnTeamChange(e.target.value || null)}
          className="min-w-0 flex-1 rounded border border-zinc-600 bg-zinc-800 px-2 py-1 font-medium text-zinc-100 focus:border-indigo-400 focus:outline-none"
        >
          <option value="">選択してください</option>
          {ownTeamCandidates.map((t) => (
            <option key={t.teamId} value={t.teamId}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      {/* md未満: チェックボックス式ドロップダウン（空きスペースいっぱいに広げる） */}
      <div className="flex items-center gap-2 md:hidden">
        <span
          className={LABEL_WIDTH + " shrink-0 whitespace-nowrap text-zinc-400"}
        >
          相手チーム
        </span>
        <OpponentDropdown
          candidates={opponentCandidates}
          selectedIds={opponentTeamIds}
          onToggle={toggleOpponent}
          className="min-w-0 flex-1"
        />
      </div>

      {/* md以上: ピル（チップ）一覧（従来表示） */}
      <div className="hidden items-start gap-2 md:flex">
        <span
          className={
            LABEL_WIDTH + " shrink-0 whitespace-nowrap pt-1 text-zinc-400"
          }
        >
          相手チーム
        </span>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {opponentCandidates.length === 0 ? (
            <span className="pt-1 text-xs text-zinc-500">候補がありません</span>
          ) : (
            opponentCandidates.map((t) => {
              const checked = opponentTeamIds.includes(t.teamId)
              return (
                <button
                  key={t.teamId}
                  type="button"
                  onClick={() => toggleOpponent(t.teamId)}
                  className={
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors " +
                    (checked
                      ? "border-amber-500 bg-amber-500/15 text-amber-300"
                      : "border-zinc-600 bg-zinc-800 text-zinc-400 hover:border-zinc-500")
                  }
                >
                  {t.name}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

type OwnTeamDropdownProps = {
  teams: TeamSummary[];
  ownTeamId: string | null;
  onChange: (teamId: string | null) => void;
  className?: string;
};

/** 自チームを単一選択するドロップダウン（md未満専用・下向きに展開） */
function OwnTeamDropdown({
  teams,
  ownTeamId,
  onChange,
  className,
}: OwnTeamDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // パネル外クリックで閉じる。pointerdown ではなく click で閉じるのが重要:
  // pointerdown だと暗幕（DimOverlay）タップ時に pointerdown 段階で overlay が unmount され、
  // 続く click が裏の要素にすり抜けてボタンが誤発火する（ゴーストクリック）。
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("click", onDocClick)
    return () => document.removeEventListener("click", onDocClick)
  }, [open])

  const selected = teams.find((t) => t.teamId === ownTeamId) ?? null

  const handleSelect = (teamId: string | null) => {
    onChange(teamId)
    setOpen(false)
  }

  return (
    <>
      {/* 開いている間は背景を薄暗くして、selector とドロップダウンだけ浮かせる（タップで閉じる） */}
      {open && <DimOverlay onClick={() => setOpen(false)} />}
      <div
        ref={ref}
        className={"relative " + (open ? "z-50 " : "") + (className ?? "")}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-1 overflow-hidden rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-left font-medium text-zinc-100 focus:border-indigo-400 focus:outline-none"
        >
          <span className="min-w-0 flex-1 truncate">
            {selected ? (
              selected.name
            ) : (
              <span className="text-zinc-400">選択してください</span>
            )}
          </span>
          <span className="shrink-0 text-xs text-zinc-400" aria-hidden>
            ▼
          </span>
        </button>
        {open && (
          <div className="absolute inset-x-0 z-10 mt-1 max-h-60 overflow-y-auto rounded-lg border border-zinc-600 bg-zinc-900 py-1 shadow-lg">
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className="flex w-full items-center px-3 py-1.5 text-left hover:bg-zinc-800"
            >
              <span className={ownTeamId === null ? "text-indigo-300" : "text-zinc-400"}>
                選択してください
              </span>
            </button>
            {teams.map((t) => {
              const isSelected = t.teamId === ownTeamId
              return (
                <button
                  key={t.teamId}
                  type="button"
                  onClick={() => handleSelect(t.teamId)}
                  className="flex w-full items-center px-3 py-1.5 text-left hover:bg-zinc-800"
                >
                  <span className={isSelected ? "text-indigo-300" : "text-zinc-300"}>
                    {t.name}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

type OpponentDropdownProps = {
  candidates: TeamSummary[];
  selectedIds: string[];
  onToggle: (teamId: string) => void;
  className?: string;
};

/** 相手チームをチェックボックスで複数選択するドロップダウン（md未満専用） */
function OpponentDropdown({
  candidates,
  selectedIds,
  onToggle,
  className,
}: OpponentDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // パネル外クリックで閉じる。pointerdown ではなく click で閉じるのが重要:
  // pointerdown だと暗幕（DimOverlay）タップ時に pointerdown 段階で overlay が unmount され、
  // 続く click が裏の要素にすり抜けてボタンが誤発火する（ゴーストクリック）。
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("click", onDocClick)
    return () => document.removeEventListener("click", onDocClick)
  }, [open])

  // 候補順を保ったまま選択中だけ抽出（トリガー内に1行で並べる）
  const selected = candidates.filter((t) => selectedIds.includes(t.teamId))

  return (
    <>
      {/* 開いている間は背景を薄暗くして、selector とドロップダウンだけ浮かせる（タップで閉じる） */}
      {open && <DimOverlay onClick={() => setOpen(false)} />}
      <div
        ref={ref}
        className={"relative " + (open ? "z-50 " : "") + (className ?? "")}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={candidates.length === 0}
          className="flex w-full items-center gap-1 overflow-hidden rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-left font-medium text-zinc-100 focus:border-indigo-400 focus:outline-none disabled:cursor-default"
        >
          {/* 選択中チーム: 1行・1つ全角7.5文字相当の固定幅・はみ出しは…・selectorからはみ出た分は overflow-hidden で非表示 */}
          <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
            {candidates.length === 0 ? (
              <span className="text-zinc-500">候補がありません</span>
            ) : selected.length === 0 ? (
              <span className="text-zinc-400">選択してください</span>
            ) : (
              selected.map((t) => (
                <span
                  key={t.teamId}
                  className="w-[7.5em] shrink-0 truncate rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-300"
                >
                  {t.name}
                </span>
              ))
            )}
          </span>
          <span className="shrink-0 text-xs text-zinc-400" aria-hidden>
            ▼
          </span>
        </button>
        {open && candidates.length > 0 && (
          <div className="absolute inset-x-0 z-10 mt-1 max-h-60 overflow-y-auto rounded-lg border border-zinc-600 bg-zinc-900 py-1 shadow-lg">
            {candidates.map((t) => {
              const checked = selectedIds.includes(t.teamId)
              return (
                <label
                  key={t.teamId}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-zinc-800"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(t.teamId)}
                    className="accent-amber-500"
                  />
                  <span
                    className={checked ? "text-amber-300" : "text-zinc-300"}
                  >
                    {t.name}
                  </span>
                </label>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
