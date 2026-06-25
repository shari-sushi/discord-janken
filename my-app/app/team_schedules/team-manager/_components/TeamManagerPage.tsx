"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import LolHeader from "@/app/lol/_components/LolHeader"
import { useOverlay } from "@/app/_client/lib/modal/ModalContext"
import { fetchSession, fetchTeamManagerView, kickMember } from "@/app/_domains/teamSchedules/_client/teamSchedulesApiClient"
import type { SessionUser, TeamManagerView, TeamMemberDetail } from "@/app/_domains/teamSchedules/types"
import { ConfirmModal } from "../../_components/ConfirmModal"
import { MembersSection } from "./MembersSection"

/** 非メンバー / 未ログイン / 不正な teamId のとき、一覧の代わりに出す案内 */
const NOT_FOUND_MESSAGE = "このチームの管理画面は表示できません。\n（チームのメンバーではない、またはログインしていません）"

/**
 * チーム管理画面（#97）。`?teamId=<uuid>` のチームについて、メンバー管理をまとめる単体ページ。
 * - ヘッダー＋「チーム管理画面」見出し＋チーム名は、そのチームのメンバーなら全員に見せる
 * - メンバー一覧は admin 相当以上にのみサーバーが返す（member には案内のみ）
 * - 非メンバー / 未ログインはサーバーが 404 を返すので、見つからない/権限なしの案内を出す
 */
export function TeamManagerPage() {
  const searchParams = useSearchParams()
  const teamId = searchParams.get("teamId")
  const { open, close } = useOverlay()

  const [session, setSession] = useState<SessionUser | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [view, setView] = useState<TeamManagerView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 管理画面データの取得（kick 後の再取得にも使う）
  const reload = useCallback(async () => {
    if (!teamId) {
      // teamId クエリが無い直アクセスも「見つからない」として扱う
      setView(null)
      setError(NOT_FOUND_MESSAGE)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const v = await fetchTeamManagerView(teamId)
      setView(v)
    } catch {
      // 非メンバー / 未ログイン → サーバーが 404。存在隠匿の方針に合わせ、理由は出し分けない
      setView(null)
      setError(NOT_FOUND_MESSAGE)
    } finally {
      setLoading(false)
    }
  }, [teamId])

  // ヘッダーのログイン表示用にセッションを取得（取得失敗・未ログインは null）
  useEffect(() => {
    void fetchSession()
      .then((u) => setSession(u))
      .catch(() => setSession(null))
      .finally(() => setSessionLoaded(true))
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  // ×押下 → はい/いいえの確認モーダル。確定で kick → 一覧を取り直す（kick は再招待で戻せるので入力確認は不要）
  const handleKick = useCallback(
    (member: TeamMemberDetail) => {
      if (!teamId) return
      open(
        <ConfirmModal
          title="メンバーを脱退させる"
          description={`${member.displayName} をこのチームから脱退させます。よろしいですか？`}
          confirmLabel="脱退させる"
          onConfirm={async () => {
            await kickMember(teamId, member.userId)
            await reload()
          }}
          onClose={close}
        />,
      )
    },
    [teamId, open, close, reload],
  )

  // ヘッダー右端のログイン表示。確定前（取得中）は何も出さない。未ログインは team_schedules へ誘導
  const loginSlot = session?.displayName ? (
    <span className="flex items-center gap-1.5 truncate text-sm text-zinc-300" title={session.displayName}>
      <span aria-hidden="true">👤</span>
      <span className="truncate">{session.displayName}</span>
    </span>
  ) : !sessionLoaded ? null : (
    <Link href="/team_schedules" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
      ログイン
    </Link>
  )

  return (
    <>
      <div className="shrink-0">
        <LolHeader rightSlot={loginSlot} />
      </div>
      {/* mobile はビューポート枠（layout.tsx の h-dvh flex）内でこの領域だけ縦スクロール、lg は通常スクロール */}
      <div className="min-h-0 flex-1 overflow-y-auto lg:overflow-visible">
        <div className="mx-auto w-full max-w-5xl p-4 md:p-6">
          <h1 className="text-xl font-bold text-zinc-100 md:text-2xl">チーム管理画面</h1>

          {loading ? (
            <p className="mt-6 text-sm text-zinc-400">読み込み中…</p>
          ) : error || !view ? (
            <div className="mt-6">
              <p className="whitespace-pre-line rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-6 text-sm leading-relaxed text-zinc-400">{error ?? NOT_FOUND_MESSAGE}</p>
              <Link href="/team_schedules" className="mt-4 inline-block text-sm text-indigo-300 hover:text-indigo-200">
                ← スケジュール調整に戻る
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-1 text-base text-zinc-300 md:text-lg">{view.teamName}</p>
              {/* currentUserId はサーバー応答（viewerUserId）由来。session 取得の遅延・失敗に依存せず、自分の行に×が出ない */}
              <MembersSection members={view.members} currentUserId={view.viewerUserId} onKick={handleKick} />
            </>
          )}
        </div>
      </div>
    </>
  )
}
