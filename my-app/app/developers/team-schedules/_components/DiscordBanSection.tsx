"use client"

import { useState } from "react"
import type { AdminDiscordBan } from "@/app/_domains/teamSchedules/types"
import { formatDateTime } from "../_utils"

type Props = {
  bans: AdminDiscordBan[]
  onAddBan: (discordUserId: string, reason: string | null) => Promise<void>
  onRemoveBan: (discordUserId: string) => void
}

/** ③ Discord BAN 管理（一覧＋追加＋解除）。新規ログインのみ遮断する旨を注記する */
export function DiscordBanSection({ bans, onAddBan, onRemoveBan }: Props) {
  const [discordUserId, setDiscordUserId] = useState("")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAdd = async () => {
    if (submitting) return
    setError(null)
    const id = discordUserId.trim()
    if (!id) {
      setError("Discord ID を入力してください")
      return
    }
    // サーバー側バリデーション（数字15〜21桁）と揃え、送信前にインラインで弾く
    if (!/^\d{15,21}$/.test(id)) {
      setError("Discord ID は数字のみ（15〜21桁）で入力してください")
      return
    }
    setSubmitting(true)
    try {
      await onAddBan(id, reason.trim() === "" ? null : reason.trim())
      setDiscordUserId("")
      setReason("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "BAN の追加に失敗しました")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section>
      <h2 className="mb-1 text-lg font-bold">Discord BAN 管理（{bans.length}）</h2>

      {/* 運用者の誤解防止: 既ログインユーザーは即時失効しないことを明記（#166） */}
      <p className="mb-3 rounded-lg border border-amber-700/60 bg-amber-950/40 p-3 text-xs leading-relaxed text-amber-200">
        ⚠️ BAN は<strong>新規ログイン（magic-link）のみ</strong>を遮断します。すでにログイン中のユーザーは最大30日のセッションが残るため、<strong>即時ログアウトされません</strong>
        （利用者ページ側での即時失効は将来対応）。
      </p>

      <div className="mb-4 rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Discord ID（数字）
            <input
              value={discordUserId}
              onChange={(e) => setDiscordUserId(e.target.value)}
              placeholder="例: 123456789012345678"
              className="w-64 rounded-md border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-zinc-400">
            理由（任意）
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例: スパム"
              className="w-full min-w-45 rounded-md border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={submitting}
            className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-50"
          >
            {submitting ? "追加中…" : "BAN 追加"}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      </div>

      {bans.length === 0 ? (
        <p className="text-sm text-zinc-400">BAN 済みの Discord ID はありません。</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-700 bg-zinc-900/60">
          <table className="w-full min-w-140 border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-700 text-left text-xs text-zinc-400">
                <th className="px-3 py-2 font-medium">Discord ID</th>
                <th className="px-3 py-2 font-medium">理由</th>
                <th className="px-3 py-2 font-medium">BAN 日時</th>
                <th className="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {bans.map((b) => (
                <tr key={b.discordUserId} className="border-b border-zinc-800">
                  <td className="px-3 py-2 break-all font-mono text-[11px] text-zinc-300">{b.discordUserId}</td>
                  <td className="px-3 py-2 text-zinc-300">{b.reason ?? "—"}</td>
                  <td className="px-3 py-2 text-zinc-300">{formatDateTime(b.bannedAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onRemoveBan(b.discordUserId)}
                      className="rounded-md border border-zinc-600 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                    >
                      解除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
