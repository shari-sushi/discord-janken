"use client"

import { useMemo } from "react"
import type { TeamMemberDetail } from "@/app/_domains/teamSchedules/types"
import type { SortKey, SortState } from "../_types"
import { ROLE_LABEL, formatJoinedAt, sortMembers } from "../_utils"

type MembersTableProps = {
  members: TeamMemberDetail[]
  /** 閲覧者（＝操作する admin 相当）の userId。自分自身には×を出さない */
  currentUserId: string
  sort: SortState
  /** ソート列のヘッダクリック（同じ列なら方向トグル、別列なら昇順から） */
  onSortChange: (key: SortKey) => void
  /** ×押下（確認モーダルは親が開く） */
  onKick: (member: TeamMemberDetail) => void
}

/** ソート可能なヘッダセル。アクティブ列には方向の▲▼を出す */
function SortableTh({ label, columnKey, sort, onSortChange }: { label: string; columnKey: SortKey; sort: SortState; onSortChange: (key: SortKey) => void }) {
  const active = sort.key === columnKey
  return (
    <th scope="col" className="whitespace-nowrap px-3 py-2 text-left font-semibold">
      <button type="button" onClick={() => onSortChange(columnKey)} className="inline-flex items-center gap-1 hover:text-zinc-100">
        <span>{label}</span>
        {/* アクティブ列のみ方向を示す。非アクティブ列はソート可能を示す薄い▲▼ */}
        <span aria-hidden className={active ? "text-indigo-300" : "text-zinc-600"}>{active ? (sort.dir === "asc" ? "▲" : "▼") : "▲▼"}</span>
      </button>
    </th>
  )
}

/**
 * メンバー一覧テーブル（#97・admin 相当のみ描画）。
 * 列順: 名前 / ステータス / ロール / 加入日 / 招待者 / Discord ID / ×
 * - ステータス列は現状つねに「アクティブ」（休止＝在籍したまま非表示は後続で実装。ソート対象外）
 * - ソート可能: 名前・ロール・加入日（ヘッダクリックで昇順⇄降順トグル）。クライアント側ソート
 * - ×（kick）: master と自分自身には出さない（サーバー側でも二重にガード）
 * スマホ幅では overflow-x-auto で横スクロールさせる。
 */
export function MembersTable({ members, currentUserId, sort, onSortChange, onKick }: MembersTableProps) {
  const sorted = useMemo(() => sortMembers(members, sort.key, sort.dir), [members, sort])

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full min-w-[720px] border-collapse text-sm text-zinc-300">
        <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs text-zinc-400">
          <tr>
            <SortableTh label="名前" columnKey="name" sort={sort} onSortChange={onSortChange} />
            <th scope="col" className="whitespace-nowrap px-3 py-2 text-left font-semibold">ステータス</th>
            <SortableTh label="ロール" columnKey="role" sort={sort} onSortChange={onSortChange} />
            <SortableTh label="加入日" columnKey="joinedAt" sort={sort} onSortChange={onSortChange} />
            <th scope="col" className="whitespace-nowrap px-3 py-2 text-left font-semibold">招待者</th>
            <th scope="col" className="whitespace-nowrap px-3 py-2 text-left font-semibold">Discord ID</th>
            <th scope="col" className="w-px px-3 py-2 text-left font-semibold"><span className="sr-only">操作</span></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) => {
            // master・自分自身は kick 不可（×を出さない）。サーバー側でも同条件でガードしている
            const canKick = m.teamRole !== "master" && m.userId !== currentUserId
            return (
              <tr key={m.userId} className="border-b border-zinc-800/60 last:border-0">
                <td className="px-3 py-2 text-zinc-100">{m.displayName}</td>
                {/* ステータスは現状つねにアクティブ（休止は未実装） */}
                <td className="whitespace-nowrap px-3 py-2">アクティブ</td>
                <td className="whitespace-nowrap px-3 py-2">{ROLE_LABEL[m.teamRole]}</td>
                <td className="whitespace-nowrap px-3 py-2">{formatJoinedAt(m.joinedAt)}</td>
                {/* 招待者不明（master 直接作成・手動追加・招待者削除済み）は「—」 */}
                <td className="px-3 py-2">{m.invitedByName ?? "—"}</td>
                {/* Discord ID は複数あればカンマ区切りで1カラム表示。0件は「—」 */}
                <td className="px-3 py-2 text-zinc-400">{m.discordUserIds.length > 0 ? m.discordUserIds.join(", ") : "—"}</td>
                <td className="px-3 py-2 text-right">
                  {canKick && (
                    <button
                      type="button"
                      onClick={() => onKick(m)}
                      aria-label={`${m.displayName} をチームから脱退させる`}
                      className="rounded border border-rose-700 bg-rose-950/40 px-2 py-1 text-xs font-medium text-rose-300 hover:bg-rose-900/40"
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
