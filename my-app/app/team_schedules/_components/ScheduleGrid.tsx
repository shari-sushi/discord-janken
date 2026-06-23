"use client"

import { useMemo } from "react"
import { type ColumnDef, type Column, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import type { CellStatus, GridRow, ScheduleColumn } from "../_types"
import { makeCellHandlers } from "../_utils"
import { ScheduleCell } from "./ScheduleCell"
import { CircleIcon } from "../_icons/StatusIcon"

type EditPayload = { teamId: string; userId: string; day: string }
type TeamEditPayload = { teamId: string; day: string }

type ScheduleGridProps = {
  rows: GridRow[]
  threshold: number
  opponentColumns: ScheduleColumn[]
  ownColumns: ScheduleColumn[]
  /** ○数列ヘッダーの上に表示する自チーム名 */
  ownTeamName: string
  onCycle: (payload: EditPayload & { current: CellStatus }) => void
  onNoteChange: (payload: EditPayload & { value: string }) => void
  /** チーム単位モード列の状態トグル（userId を持たない） */
  onTeamCycle: (payload: TeamEditPayload & { current: CellStatus }) => void
  onTeamNoteChange: (payload: TeamEditPayload & { value: string }) => void
  /** 「もっと見る」押下で表示期間を延ばす（#171） */
  onLoadMore?: () => void
  /** 上限未満で「もっと見る」を表示するか（#171） */
  canLoadMore?: boolean
}

const SIZE = { date: 64, count: 64, opponent: 70, member: 78 }

// 2段ヘッダーの上段（自チーム名）の固定高さ(px)。下段ヘッダーの sticky top に使うため固定値にする。
const OWN_NAME_H = 16
// 自チーム名の左インデント(px)。padding/margin だと横スクロールでスペースが消えるため、
// sticky の left オフセットに織り込んで、スクロールしても余白ごと固定されるようにする（≒ pl-5）。
const OWN_NAME_INDENT = 20

const HEADER_BASE = "border-b border-r border-zinc-700 md:px-2  md:py-2 text-xs font-semibold"

/**
 * 行の背景色（成立 > 詰み > 通常）。
 * sticky 列の下を非固定セルが流れても透けないよう、すべて不透明（solid）にする。
 * 成立行は「emerald-900 を 30% で zinc-900 に重ねた色」を不透明化した #132825。
 */
function rowBgClass(row: GridRow): string {
  if (row.success) return "bg-[#132825]"
  if (row.impossible) return "bg-zinc-950"
  return "bg-zinc-900"
}

/**
 * チーム単位モード列のセル全体を状態別に強調する（他チームからの視認性向上）。
 * ○: 背景を少し明るく / ×: セル中身を薄く（opacity 60）。△・未記入は通常表示。
 */
function teamCellEmphasis(status: CellStatus): { bg: string | null; faded: boolean } {
  // ○: emerald-900 を 40% で zinc-900 に重ねた色を不透明化した #112e28（sticky 列で透けないよう solid）
  if (status === "ok") return { bg: "bg-[#112e28]", faded: false }
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

export function ScheduleGrid({ rows, threshold, opponentColumns, ownColumns, ownTeamName, onCycle, onNoteChange, onTeamCycle, onTeamNoteChange, onLoadMore, canLoadMore }: ScheduleGridProps) {
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
          <div className="flex flex-row items-center gap-0.5 pt-1">
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
      // 自チーム名は countCol 単体ではなく、○数〜各メンバーをまたぐ上段ヘッダーで表示する（thead で組み立て）
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

    const ownCols: ColumnDef<GridRow>[] = ownColumns.map((col) => ({
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
    const ownIsTeamMode = ownColumns[0]?.kind === "team"
    // 日付を一番左に。続けて 相手チーム → ○数（自チーム集計・members モードのみ）→ 各メンバー
    return [dateCol, ...opponentCols, ...(ownIsTeamMode ? [] : [countCol]), ...ownCols]
  }, [opponentColumns, ownColumns, threshold, onCycle, onNoteChange, onTeamCycle, onTeamNoteChange])

  // ピン留め（sticky-left）は日付＋相手チームのみ。○数〜各メンバー（自チーム区画）は
  // 上段の自チーム名ヘッダーと一体でスクロールさせたいので、○数のピン留めはしない。
  const leftPinned = useMemo(() => {
    return ["date", ...opponentColumns.map((c) => `opp:${c.teamId}`)]
  }, [opponentColumns])

  // td の className 算出でセル状態を引くための、テーブル列ID → ScheduleColumn の対応表。
  // opponent/member いずれも ScheduleColumn.id がテーブル列IDと一致する（opp:teamId / own:userId など）。
  const columnById = useMemo(() => {
    const m = new Map<string, ScheduleColumn>()
    for (const c of [...opponentColumns, ...ownColumns]) m.set(c.id, c)
    return m
  }, [opponentColumns, ownColumns])

  // TanStack Table の useReactTable は関数を返すため React Compiler でメモ化されない
  // （既知のライブラリ制約。動作には影響しないため抑制する）
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: { columnPinning: { left: leftPinned, right: [] } },
  })

  // 自チーム区画の下段ヘッダー（○数＋各メンバー）。members モードは ○数＋メンバー、team モードはチーム1列。
  const ownIsTeamMode = ownColumns[0]?.kind === "team"
  const ownLeaves: { key: string; node: React.ReactNode; bg: string; size: number }[] = [
    ...(ownIsTeamMode ? [] : [{ key: "count", node: "○数", bg: "bg-zinc-800 text-zinc-300", size: SIZE.count }]),
    ...ownColumns.map((c) => ({ key: c.id, node: c.label, bg: c.editable ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-300", size: SIZE.member })),
  ]
  // 2列以上のときだけ上段にチーム名をまたがせる（1列＝team モードはその列ヘッダーを2段ぶち抜きにする）
  const ownGrouped = ownLeaves.length >= 2
  // 自チーム名（上段）をピン留めする左オフセット = 日付＋相手チーム（ピン留め列）の合計幅。
  // これにより横スクロールしてもチーム名だけは相手列の右に常に残る。
  const ownSectionLeft = SIZE.date + opponentColumns.length * SIZE.opponent

  return (
    <div className="h-full min-w-0 overflow-auto rounded-lg border border-zinc-700 bg-zinc-900 lg:h-auto">
      <table className="border-collapse text-sm">
        {/*
          2段ヘッダー。日付・相手チームは rowSpan=2 で2段ぶち抜き（従来どおりピン留め）。
          自チーム区画（○数＋各メンバー）は上段にチーム名を colSpan で渡し、下段に各列ヘッダーを置く。
          下段は sticky top を上段の高さ(OWN_NAME_H)に合わせて、縦スクロールでも2段固定する。
        */}
        <thead>
          <tr>
            {/* 日付: 2段ぶち抜き・ピン留め */}
            <th
              rowSpan={2}
              className={HEADER_BASE + " text-center align-middle bg-zinc-800 text-zinc-300"}
              style={{ position: "sticky", left: 0, top: 0, zIndex: 30, minWidth: SIZE.date, width: SIZE.date }}
            >
              日付
            </th>
            {/* 相手チーム: 2段ぶち抜き・ピン留め・相手セレクタの選択中チップと同色（amber） */}
            {opponentColumns.map((c, i) => (
              <th
                key={`opp:${c.teamId}`}
                rowSpan={2}
                className={HEADER_BASE + " text-center align-middle bg-amber-500/15 text-amber-300"}
                style={{ position: "sticky", left: SIZE.date + i * SIZE.opponent, top: 0, zIndex: 30, minWidth: SIZE.opponent, width: SIZE.opponent }}
              >
                {c.label}
              </th>
            ))}
            {/* 自チーム: 上段にチーム名（○数〜各メンバーをまたぐ）。自分の色（indigo）で目立たせ、はみ出しは title で全文表示 */}
            {ownGrouped ? (
              <th colSpan={ownLeaves.length} className="border-b border-r border-zinc-700 px-2 text-left bg-indigo-500/15" style={{ position: "sticky", top: 0, zIndex: 20, height: OWN_NAME_H }}>
                {/*
                  colSpan セル自体への sticky-left は border-collapse 下で効かないことがあるため、
                  ラベル（span）を sticky-left で固定する。セルは幅が広く背景は残るので、横スクロールしても
                  チーム名テキストだけが相手列の右に常に残る。左インデントは padding でなく left に織り込み、
                  スクロールしても余白ごと固定する。
                */}
                <span
                  title={ownTeamName}
                  className="inline-block whitespace-nowrap text-[10px] font-medium leading-none text-indigo-300"
                  style={{ position: "sticky", left: ownSectionLeft + OWN_NAME_INDENT }}
                >
                  {ownTeamName}
                </span>
              </th>
            ) : (
              // 自チームが1列（team モード）なら、その列ヘッダーを2段ぶち抜きで表示する
              ownLeaves.map((l) => (
                <th key={l.key} rowSpan={2} className={HEADER_BASE + " text-center align-middle " + l.bg} style={{ position: "sticky", top: 0, zIndex: 20, minWidth: l.size }}>
                  {l.node}
                </th>
              ))
            )}
          </tr>
          {ownGrouped && (
            <tr>
              {/* 下段: ○数＋各メンバー。sticky top は上段の高さに合わせる */}
              {ownLeaves.map((l) => (
                <th
                  key={l.key}
                  className={"border-b border-r border-zinc-700 px-2 py-0.5 text-center text-xs font-semibold " + l.bg}
                  style={{ position: "sticky", top: OWN_NAME_H, zIndex: 20, minWidth: l.size }}
                >
                  {l.node}
                </th>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const r = row.original
            const bg = rowBgClass(r)
            return (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  const col = cell.column
                  const pinned = col.getIsPinned() === "left"
                  const schedCol = columnById.get(col.id)
                  const isTeamCol = schedCol?.kind === "team"
                  const editableOwn = ownColumns.find((c) => c.id === col.id)?.editable
                  // ピン留め列（日付・相手）と ○数 は行背景を敷く（○数はピン留めしないが集計列なので行背景を維持）。
                  // 自メンバー列は編集中のみハイライト。team 列は bg を状態強調に使うため indigo bg は敷かない（編集可は下の ring で表現）
                  let cellBg = pinned || col.id === "count" ? bg : editableOwn && !isTeamCol ? "bg-indigo-950/40" : ""
                  // チーム単位モード列は、その日のセル状態に応じてセル全体を強調する（○=bg を上書き / ×=中身を薄く）。
                  // ○の強調 bg は成立行の背景に近い不透明の emerald 系（#112e28）。ピン留め相手team列でも視認性優先で行背景より優先する。
                  const emphasis = isTeamCol ? teamCellEmphasis(schedCol!.cells.get(r.date.key)?.status ?? "none") : null
                  if (emphasis?.bg) cellBg = emphasis.bg
                  // 編集可能な team 列は bg を状態強調に使うため、編集可インジケータは ring（枠線）で表現する（bg と両立）
                  const teamEditRing = isTeamCol && schedCol!.editable ? " ring-1 ring-inset ring-indigo-500/50" : ""
                  const content = flexRender(col.columnDef.cell, cell.getContext())
                  // 薄く見せるのは「中身だけ」に opacity を掛ける（td/tr 全体に掛けると sticky 列でも透けるため）。
                  // 詰み行は行全体を opacity-70、team× セルはその中身を opacity-60 で薄くする。
                  const fadeClass = r.impossible ? "opacity-70" : emphasis?.faded ? "opacity-60" : null
                  // ○数列だけ横padを半分にして（px-1.5→px-[3px]）活動可バッジの幅を確保する
                  const xPad = col.id === "count" ? "px-[3px]" : "px-1.5"
                  return (
                    <td
                      key={cell.id}
                      className={"border-b border-r border-zinc-700 py-1.5 align-top text-center " + xPad + " " + cellBg + teamEditRing}
                      style={{ ...pinnedStyle(col, false), minWidth: col.getSize(), width: pinned ? col.getSize() : undefined }}
                    >
                      {fadeClass ? <div className={fadeClass}>{content}</div> : content}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      {/* もっと見る: スクロール領域の中・テーブル直下に置く。
          モバイルではこの div 自体が内部スクロールするため、外側に固定するとテーブルの下に出ない（#171）。 */}
      <div className="flex justify-center border-t border-zinc-800 p-2">
        <button
          disabled={!canLoadMore}
          type="button"
          onClick={onLoadMore}
          className="rounded-lg border border-zinc-600 bg-zinc-900 disabled:opacity-50 px-4 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:hover:bg-zinc-900"
        >
          もっと見る
        </button>
      </div>
    </div>
  )
}
