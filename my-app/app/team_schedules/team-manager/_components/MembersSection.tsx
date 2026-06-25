"use client"

import { useState } from "react"
import type { TeamMemberDetail } from "@/app/_domains/teamSchedules/types"
import type { SortKey, SortState } from "../_types"
import { MembersTable } from "./MembersTable"

type MembersSectionProps = {
  /** admin 相当はメンバー配列、member は null（一覧は管理者のみ閲覧可） */
  members: TeamMemberDetail[] | null
  /** 閲覧者の userId（自分自身に×を出さないため） */
  currentUserId: string
  /** ×押下（親が確認モーダルを開いて kick → 再取得まで担当） */
  onKick: (member: TeamMemberDetail) => void
}

/**
 * 「メンバー一覧」セクション（#97）。
 * - admin / master: ソート可能なテーブルを表示（×で kick）
 * - member: 一覧の代わりに「管理者のみ閲覧できる」案内を表示
 */
export function MembersSection({ members, currentUserId, onKick }: MembersSectionProps) {
  // 既定はサーバーの返却順（加入日昇順）に合わせる
  const [sort, setSort] = useState<SortState>({ key: "joinedAt", dir: "asc" })

  // 同じ列をクリックしたら方向トグル、別列なら昇順から
  const handleSortChange = (key: SortKey) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }))
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-zinc-100">メンバー一覧</h2>
      {members === null ? (
        <p className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-6 text-center text-sm text-zinc-400">メンバー一覧の閲覧・管理は管理者のみ可能です。</p>
      ) : (
        <div className="mt-3">
          <MembersTable members={members} currentUserId={currentUserId} sort={sort} onSortChange={handleSortChange} onKick={onKick} />
        </div>
      )}
    </section>
  )
}
