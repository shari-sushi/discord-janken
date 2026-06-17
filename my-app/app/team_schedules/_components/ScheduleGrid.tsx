"use client"

import { useMemo } from "react"
import { type ColumnDef, type Column, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import type { CellStatus, GridRow, ScheduleColumn } from "../_types"
import { makeCellHandlers } from "../_utils"
import { ScheduleCell } from "./ScheduleCell"

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

const SIZE = { date: 76, count: 52, opponent: 70, success: 60, member: 78 }

const HEADER_BASE = "border-b border-r border-zinc-700 px-2 py-2 text-xs font-semibold"

/** 行の背景色（成立 > 詰み > 通常） */
function rowBgClass(row: GridRow): string {
  if (row.success) return "bg-emerald-900/30"
  if (row.impossible) return "bg-zinc-950"
  return "bg-zinc-900"
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
        const d = row.original.date
        const wkColor = d.isSunday ? "text-rose-400" : d.isSaturday ? "text-sky-400" : "text-zinc-200"
        return (
          <span className={"text-xs font-medium " + wkColor}>
            {d.label}
            <span className="ml-0.5 text-[11px]">（{d.weekday}）</span>
          </span>
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
          <span className={"text-sm font-bold " + (r.okCount >= threshold ? "text-emerald-400" : "text-zinc-500")}>
            {r.okCount}
            {r.maybeCount > 0 && <span className="ml-0.5 text-[10px] font-normal text-amber-500">+{r.maybeCount}△</span>}
          </span>
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
        return <ScheduleCell status={view.status} note={view.note} editable={col.editable} dim={view.status === "ng"} onCycle={handlers.onCycle} onNoteChange={handlers.onNoteChange} />
      },
    }))

    const successCol: ColumnDef<GridRow> = {
      id: "success",
      header: "成立",
      size: SIZE.success,
      cell: ({ row }) =>
        row.original.success ? (
          <span className="inline-block rounded bg-emerald-600 px-1.5 py-0.5 text-[11px] font-bold text-white">成立</span>
        ) : (
          <span className="text-xs text-zinc-600">—</span>
        ),
    }

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

    return [dateCol, countCol, ...opponentCols, successCol, ...memberCols]
  }, [opponentColumns, memberColumns, threshold, onCycle, onNoteChange, onTeamCycle, onTeamNoteChange])

  const leftPinned = useMemo(() => ["date", "count", ...opponentColumns.map((c) => `opp:${c.teamId}`), "success"], [opponentColumns])

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
    <div className="overflow-auto rounded-lg border border-zinc-700 bg-zinc-900">
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
                    style={{ ...pinnedStyle(col, true), top: 0, minWidth: col.getSize(), width: pinned ? col.getSize() : undefined, zIndex: pinned ? 30 : 20 }}
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
                  const editableMember = memberColumns.find((c) => c.id === col.id)?.editable
                  // ピン留め列（日付・○数・相手・成立）は行背景を敷く。自メンバー列は編集中のみハイライト
                  const cellBg = pinned ? bg : editableMember ? "bg-indigo-950/40" : ""
                  return (
                    <td
                      key={cell.id}
                      className={"border-b border-r border-zinc-700 px-1.5 py-1.5 align-top text-center " + cellBg}
                      style={{ ...pinnedStyle(col, false), minWidth: col.getSize(), width: pinned ? col.getSize() : undefined }}
                    >
                      {flexRender(col.columnDef.cell, cell.getContext())}
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
