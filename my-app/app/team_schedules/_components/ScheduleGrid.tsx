"use client"

import { useMemo } from "react"
import { type ColumnDef, type Column, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import type { CellStatus, GridRow, ScheduleColumn } from "../_types"
import { makeCellHandlers } from "../_utils"
import { ScheduleCell } from "./ScheduleCell"
import { CircleIcon } from "./StatusIcon"

type EditPayload = { teamId: string; userId: string; day: string }
type TeamEditPayload = { teamId: string; day: string }

type ScheduleGridProps = {
  rows: GridRow[]
  threshold: number
  opponentColumns: ScheduleColumn[]
  memberColumns: ScheduleColumn[]
  onCycle: (payload: EditPayload & { current: CellStatus }) => void
  onNoteChange: (payload: EditPayload & { value: string }) => void
  /** チーム単位モード列の状態トグル（userId を持たない） */
  onTeamCycle: (payload: TeamEditPayload & { current: CellStatus }) => void
  onTeamNoteChange: (payload: TeamEditPayload & { value: string }) => void
}

const SIZE = { date: 64, count: 64, opponent: 70, member: 78 }

const HEADER_BASE = "border-b border-r border-zinc-700 md:px-2  md:py-2 text-xs font-semibold"

/** 行の背景色（成立 > 詰み > 通常） */
function rowBgClass(row: GridRow): string {
  if (row.success) return "bg-emerald-900/30"
  if (row.impossible) return "bg-zinc-950"
  return "bg-zinc-900"
}

/**
 * チーム単位モード列のセル全体を状態別に強調する（他チームからの視認性向上）。
 * ○: 背景を少し明るく / ×: セル全体を薄く（opacity 30）。△・未記入は通常表示。
 */
function teamCellEmphasis(status: CellStatus): { bg: string | null; faded: boolean } {
  if (status === "ok") return { bg: "bg-emerald-900/40", faded: false }
  if (status === "ng") return { bg: null, faded: true }
  return { bg: null, faded: false }
}

/** ピン留めされた列の sticky スタイルを返す */
function pinnedStyle(column: Column<GridRow>, isHeader: boolean): React.CSSProperties | undefined {
  if (column.getIsPinned() !== "left") return undefined
  return {
    position: "sticky",
    left: column.getStart("left"),
    zIndex: isHeader ? 30 : 10,
  }
}

export function ScheduleGrid({ rows, threshold, opponentColumns, memberColumns, onCycle, onNoteChange, onTeamCycle, onTeamNoteChange }: ScheduleGridProps) {
  const columns = useMemo<ColumnDef<GridRow>[]>(() => {
    // 列の種別に応じた編集ハンドラ（表・カード共通の makeCellHandlers に委譲）
    const cellHandlers = (col: ScheduleColumn, day: string, current: CellStatus) => makeCellHandlers(col, day, current, { onCycle, onNoteChange, onTeamCycle, onTeamNoteChange })

    const dateCol: ColumnDef<GridRow> = {
      id: "date",
      header: "日付",
      size: SIZE.date,
      cell: ({ row }) => {
        const r = row.original
        const d = r.date
        // 祝日は日曜と同じ扱い（赤系）。祝日名はツールチップで補足する
        const wkColor = d.isSunday || d.isHoliday ? "text-rose-400" : d.isSaturday ? "text-sky-400" : "text-zinc-200"
        return (
          <div className="flex flex-col items-start gap-0.5">
            <span className={"text-xs font-medium " + wkColor} title={d.holidayName ?? undefined}>
              {d.label}
              <span className="ml-0.5 text-[11px]">({d.weekday})</span>
            </span>
          </div>
        )
      },
    }

    const countCol: ColumnDef<GridRow> = {
      id: "count",
      header: "○数",
      size: SIZE.count,
      cell: ({ row }) => {
        const r = row.original
        return (
          <div className="flex flex-col items-center gap-0.5">
            <span className={"text-sm font-bold " + (r.okCount >= threshold ? "text-emerald-400" : "text-zinc-500")}>
              {r.okCount}
              {r.maybeCount > 0 && <span className="ml-0.5 text-[10px] font-normal text-amber-500">+{r.maybeCount}△</span>}
            </span>
            {/* 自チームが活動可能な日は check_circle アイコンで明示（成立=相手も一致 とは別軸） */}
            {r.ownActive && (
              <span title="活動可" className="inline-flex">
                <CircleIcon className="h-[1.4rem] w-[1.4rem] fill-emerald-500" />
              </span>
            )}
          </div>
        )
      },
    }

    const opponentCols: ColumnDef<GridRow>[] = opponentColumns.map((col) => ({
      id: `opp:${col.teamId}`,
      header: col.label,
      size: SIZE.opponent,
      cell: ({ row }) => {
        const day = row.original.date.key
        const view = col.cells.get(day) ?? { status: "none" as CellStatus, note: "" }
        const handlers = cellHandlers(col, day, view.status)
        // team モードはセル全体を opacity-60 で薄くするため（td側）、ボタン単体の dim は二重適用を避けて付けない
        return (
          <ScheduleCell
            status={view.status}
            note={view.note}
            editable={col.editable}
            dim={col.kind !== "team" && view.status === "ng"}
            onCycle={handlers.onCycle}
            onNoteChange={handlers.onNoteChange}
          />
        )
      },
    }))

    const memberCols: ColumnDef<GridRow>[] = memberColumns.map((col) => ({
      id: col.id,
      header: col.label,
      size: SIZE.member,
      cell: ({ row }) => {
        const day = row.original.date.key
        const view = col.cells.get(day) ?? { status: "none" as CellStatus, note: "" }
        const handlers = cellHandlers(col, day, view.status)
        return <ScheduleCell status={view.status} note={view.note} editable={col.editable} onCycle={handlers.onCycle} onNoteChange={handlers.onNoteChange} />
      },
    }))

    // チーム単位モードの自チームは1列でその日の○△×を直接表示するため、○数（集計）列は不要
    const ownIsTeamMode = memberColumns[0]?.kind === "team"
    // 日付を一番左に。続けて 相手チーム → ○数（自チーム集計・members モードのみ）→ 各メンバー
    return [dateCol, ...opponentCols, ...(ownIsTeamMode ? [] : [countCol]), ...memberCols]
  }, [opponentColumns, memberColumns, threshold, onCycle, onNoteChange, onTeamCycle, onTeamNoteChange])

  const leftPinned = useMemo(() => {
    const ownIsTeamMode = memberColumns[0]?.kind === "team"
    return ["date", ...opponentColumns.map((c) => `opp:${c.teamId}`), ...(ownIsTeamMode ? [] : ["count"])]
  }, [opponentColumns, memberColumns])

  // td の className 算出でセル状態を引くための、テーブル列ID → ScheduleColumn の対応表。
  // opponent/member いずれも ScheduleColumn.id がテーブル列IDと一致する（opp:teamId / own:userId など）。
  const columnById = useMemo(() => {
    const m = new Map<string, ScheduleColumn>()
    for (const c of [...opponentColumns, ...memberColumns]) m.set(c.id, c)
    return m
  }, [opponentColumns, memberColumns])

  // TanStack Table の useReactTable は関数を返すため React Compiler でメモ化されない
  // （既知のライブラリ制約。動作には影響しないため抑制する）
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: { columnPinning: { left: leftPinned, right: [] } },
  })

  return (
    <div className="h-full min-w-0 overflow-auto rounded-lg border border-zinc-700 bg-zinc-900 lg:h-auto">
      <table className="border-collapse text-sm">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => {
                const col = header.column
                const pinned = col.getIsPinned() === "left"
                const isEditableMember = memberColumns.find((c) => c.id === col.id)?.editable
                const isEditableOpp = opponentColumns.find((c) => `opp:${c.teamId}` === col.id)?.editable
                const editable = isEditableMember || isEditableOpp
                const bg = editable ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-300"
                return (
                  <th
                    key={header.id}
                    className={HEADER_BASE + " text-center " + bg}
                    // position:sticky + top:0 で縦スクロール時はヘッダーを固定。pinned 列のみ left も付くため横スクロールでも残り、
                    // メンバー列ヘッダーは left を持たない＝縦は固定だが横スクロールでは一緒に流れる。
                    style={{ ...pinnedStyle(col, true), position: "sticky", top: 0, minWidth: col.getSize(), width: pinned ? col.getSize() : undefined, zIndex: pinned ? 30 : 20 }}
                  >
                    {flexRender(col.columnDef.header, header.getContext())}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const r = row.original
            const bg = rowBgClass(r)
            return (
              <tr key={row.id} className={r.impossible ? "opacity-70" : ""}>
                {row.getVisibleCells().map((cell) => {
                  const col = cell.column
                  const pinned = col.getIsPinned() === "left"
                  const schedCol = columnById.get(col.id)
                  const isTeamCol = schedCol?.kind === "team"
                  const editableMember = memberColumns.find((c) => c.id === col.id)?.editable
                  // ピン留め列（日付・○数・相手・成立）は行背景を敷く。自メンバー列は編集中のみハイライト。
                  // team 列は bg を状態強調に使うため indigo bg は敷かない（編集可は下の ring で表現）
                  let cellBg = pinned ? bg : editableMember && !isTeamCol ? "bg-indigo-950/40" : ""
                  // チーム単位モード列は、その日のセル状態に応じてセル全体を強調する（○=bg を上書き / ×=中身を薄く）。
                  // ○の強調 bg は成立行の背景と同じく半透明の emerald 系。ピン留め相手team列でも視認性優先で行背景より優先する。
                  const emphasis = isTeamCol ? teamCellEmphasis(schedCol!.cells.get(r.date.key)?.status ?? "none") : null
                  if (emphasis?.bg) cellBg = emphasis.bg
                  // 編集可能な team 列は bg を状態強調に使うため、編集可インジケータは ring（枠線）で表現する（bg と両立）
                  const teamEditRing = isTeamCol && schedCol!.editable ? " ring-1 ring-inset ring-indigo-500/50" : ""
                  // × セルは td の bg は変えず（行背景のまま）、中身だけ opacity-60 で薄くする
                  const content = flexRender(col.columnDef.cell, cell.getContext())
                  // ○数列だけ横padを半分にして（px-1.5→px-[3px]）活動可バッジの幅を確保する
                  const xPad = col.id === "count" ? "px-[3px]" : "px-1.5"
                  return (
                    <td
                      key={cell.id}
                      className={"border-b border-r border-zinc-700 py-1.5 align-top text-center " + xPad + " " + cellBg + teamEditRing}
                      style={{ ...pinnedStyle(col, false), minWidth: col.getSize(), width: pinned ? col.getSize() : undefined }}
                    >
                      {emphasis?.faded ? <div className="opacity-60">{content}</div> : content}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
