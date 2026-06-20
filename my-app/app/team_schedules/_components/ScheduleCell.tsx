"use client"

import { useState } from "react"
import type { CellStatus } from "../_types"
import { STATUS_STYLE } from "../_utils"
import { StatusIcon } from "../_icons/StatusIcon"

type ScheduleCellProps = {
  status: CellStatus
  note: string
  editable: boolean
  /** セルだけ薄く（相手の不可セルなど） */
  dim?: boolean
  onCycle?: () => void
  onNoteChange?: (value: string) => void
}

/** 状態トグルボタン + 時間メモ欄のセル */
export function ScheduleCell({ status, note, editable, dim = false, onCycle, onNoteChange }: ScheduleCellProps) {
  const style = STATUS_STYLE[status]

  // 入力中に親 state（schedulesByTeam）を更新するとグリッド全体が再計算・再マウントされ、
  // input のフォーカスが外れてしまう（#127）。そのため入力中はローカル state で文字を保持し、
  // blur 時にまとめて親へ反映する。これで毎キーの再描画と upsert API 呼び出しも防げる。
  const [draft, setDraft] = useState(note)
  // 親側 note の変化（状態トグル・チーム切替・外部更新等）にローカル値を同期する。
  // effect ではなく render 中に前回値と比較する React 公式推奨パターン。
  // 入力中は note prop が変わらない（コミットは blur 時のみ）ため、打鍵を上書きすることはない。
  const [prevNote, setPrevNote] = useState(note)
  if (note !== prevNote) {
    setPrevNote(note)
    setDraft(note)
  }

  const commitNote = () => {
    // 未編集なら余計な POST・再描画を避ける
    if (draft !== note) onNoteChange?.(draft)
  }

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={editable ? onCycle : undefined}
        disabled={!editable}
        aria-label={style.label}
        className={
          "mx-auto flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 " +
          style.className +
          // 未編集（他人の予定等）は矢印カーソル。globals.css の未レイヤー `button{cursor:pointer}` に
          // 勝つため important 修飾子（cursor-default!）で上書きする。
          (editable ? " cursor-pointer hover:opacity-80" : " cursor-default!") +
          (dim ? " opacity-65" : "")
        }
      >
        {/* ○△× はアイコンに差し替え（none は専用アイコンが無いので "–" を表示） */}
        {status === "none" ? style.symbol : <StatusIcon status={status} />}
      </button>
      {editable ? (
        // 状態が未記入のうちはメモを保存する行が無いため、入力欄を非活性にする
        // （○/△/× を付けてから時間を書く運用。none のまま打っても破棄されるのを防ぐ）
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // ボタン押下時はクリックより先に blur が発火するため、状態トグル前に必ずコミットされる
          onBlur={commitNote}
          // Enter で確定（blur を促してコミットする）。
          // IME 変換確定の Enter（isComposing 中）は対象外にする（日本語入力を中断しないため）
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) e.currentTarget.blur()
          }}
          disabled={status === "none"}
          placeholder="時間"
          className={
            "mt-1 w-14 rounded border border-zinc-600 bg-zinc-800 px-1 py-0.5 text-center text-[11px] text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-400 focus:outline-none " +
            (status === "none" ? "cursor-not-allowed bg-zinc-900 text-zinc-600 placeholder:text-zinc-600" : "")
          }
        />
      ) : (
        <div className="mt-1 h-4.5 text-[11px] leading-4.5 text-zinc-400">{note || ""}</div>
      )}
    </div>
  )
}
