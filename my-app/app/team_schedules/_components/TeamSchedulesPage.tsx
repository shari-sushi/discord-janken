"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import LolHeader from "@/app/lol/_components/LolHeader"
import { useOverlay } from "@/app/_client/lib/modal/ModalContext"
import type { ScheduleEntry, ScheduleStatus, SessionUser, TeamSchedule, TeamSummary } from "@/app/_domains/teamSchedules/types"
import { hasAdminAuthority } from "@/app/_domains/teamSchedules/types"
import {
  acceptShare,
  createInvite,
  createShareInvite,
  deleteAccount,
  deleteSchedule,
  deleteShare,
  deleteTeamStatus,
  disbandTeam,
  fetchSession,
  fetchSharePreview,
  fetchTeamSchedule,
  fetchTeams,
  joinTeam,
  leaveTeam,
  logout,
  succeedMaster,
  upsertSchedule,
  upsertTeamStatus,
  verifyMagicLink,
} from "@/app/_domains/teamSchedules/_client/teamSchedulesApiClient"
import { COMMANDS } from "@/app/_server/util/commands"
import type { CellStatus, GridRow, ScheduleColumn } from "../_types"
import { aggregateDay, buildDateRange, cycleStatus, indexSchedules, indexTeamStatus, summarizeTeamStatus, toCellStatus, toScheduleStatus } from "../_utils"
import { setStoredSelection, useStoredSelection } from "../_selectionStore"
import type { ViewMode } from "../_viewModeStore"
// 表↔カード切替トグルを復活させる際に使う（一旦コメントアウト中）
// import { setStoredViewMode } from "../_viewModeStore"
// import { useIsSmartphone } from "../_useIsSmartphone"
import { ConfirmByTypingModal } from "./ConfirmByTypingModal"
import { ConfirmModal } from "./ConfirmModal"
import { ControlBar } from "./ControlBar"
import { CreateTeamModal } from "./CreateTeamModal"
import { CreateTeamRestrictedModal } from "./CreateTeamRestrictedModal"
import { DbHealthButton } from "./DbHealthButton"
import { InviteModal } from "./InviteModal"
import { LoginModal } from "./LoginModal"
import { ShareAcceptModal } from "./ShareAcceptModal"
import { ScheduleDayCards } from "./ScheduleDayCards"
import { ScheduleGrid } from "./ScheduleGrid"
import { ScheduleHelpModal } from "./ScheduleHelpModal"
import { ScrollFadeRow } from "./ScrollFadeRow"
import { TeamCompareSelector } from "./TeamCompareSelector"
import { SettingModal, DEFAULT_SETTING_TAB, isSettingTab, type SettingTab } from "./SettingModal"
import { SettingsIcon } from "../_icons/SettingsIcon"
import { CollapseIcon } from "../_icons/CollapseIcon"

const NUM_DAYS = 14

/** 招待リンクからの参加トークンを、ログイン往復をまたいで保持する sessionStorage キー */
const PENDING_JOIN_KEY = "ts_pending_join"

/** 共有リンクからの共有トークンを、ログイン往復をまたいで保持する sessionStorage キー（#175） */
const PENDING_SHARE_KEY = "ts_pending_share"

export function TeamSchedulesPage() {
  const { open, close } = useOverlay()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [start] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const dates = useMemo(() => buildDateRange(start, NUM_DAYS), [start])
  const dayKeys = useMemo(() => dates.map((d) => d.key), [dates])

  const [session, setSession] = useState<SessionUser | null>(null)
  const [teams, setTeams] = useState<TeamSummary[]>([])
  const [schedulesByTeam, setSchedulesByTeam] = useState<Record<string, TeamSchedule>>({})
  // 比較チーム選択は localStorage に永続化する（リロードしても直前の選択を復元）
  const { ownTeamId, opponentTeamIds } = useStoredSelection()
  const setOwnTeamId = useCallback((id: string | null) => setStoredSelection((prev) => ({ ...prev, ownTeamId: id })), [])
  const setOpponentTeamIds = useCallback((ids: string[]) => setStoredSelection((prev) => ({ ...prev, opponentTeamIds: ids })), [])
  // 表示モードは常に「表」。スマホでもカードではなく表を表示する。
  // 表↔カードの切替トグルは一旦コメントアウト中（下部ヘッダー参照）。カード描画分岐は復活時のため残す。
  // as ViewMode で union 型を保ち、下の viewMode === "card" 分岐をリテラル絞り込みで型エラーにしないようにしている。
  const viewMode = "table" as ViewMode
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  // lg未満（カレンダーだけスクロールする縦圧縮レイアウト）で、表以外のチーム選択・凡例を畳んで
  // 表に縦スペースを譲る。lg以上では常に展開（トグルも非表示）。(#156)
  const [chromeCollapsed, setChromeCollapsed] = useState(false)
  // 折りたたみ領域の overflow。畳みアニメ中は overflow-hidden で中身を隠す必要があるが、
  // 展開しきった状態では自チーム/相手チームのドロップダウン（absolute）が領域外へ出られるよう
  // overflow-visible にする（#156 のアニメと、未選択時にドロップダウンがグリッド案内文の後ろへ
  // 隠れる不具合の両立）。畳む時は即クリップ、展開時はアニメ完了後（onTransitionEnd）に可視化する。
  const [chromeOverflowVisible, setChromeOverflowVisible] = useState(true)
  // 折りたたみトグル。畳む時は即クリップ（スライドを正しく見せる）、展開時はアニメ完了後
  // （grid の onTransitionEnd）に overflow を可視化する。
  const toggleChrome = () => {
    const next = !chromeCollapsed
    setChromeCollapsed(next)
    if (next) setChromeOverflowVisible(false)
  }
  // 選択の整合（後段の reconcile 効果で参照）。magic-link ログイン確立後の再取得で
  // false に戻し、正しい isMember を反映した teams でもう一度だけ走らせる。
  const reconciledRef = useRef(false)
  // 同一チームの取得が複数 effect 発火で二重に走らないようにする（#165: 先読みと選択取得の重複防止）
  const fetchingRef = useRef<Set<string>>(new Set())

  // token / join を URL から消す際、対象チーム選択用の team= だけは残して掃除する。
  // 招待リンク（?join=...&team=...）は join を消費しても team を後段の効果で読み取る必要があるため、
  // 一括で全クエリを消す router.replace は使わない。team が無ければ素のパスに戻す。
  // 呼び出し時点の最新クエリを window.location から読む（searchParams を deps に入れると
  // この関数の同一性が毎レンダリングで変わり、token/join 効果が再実行され verifyMagicLink が
  // 二重呼び出しされ得るため）。router は安定参照。
  const cleanUrlKeepingTeam = useCallback(() => {
    const t = new URLSearchParams(window.location.search).get("team")
    router.replace(t ? `/team_schedules?team=${encodeURIComponent(t)}` : "/team_schedules")
  }, [router])

  // ログイン着地: URLに ?token= があれば magic-link を検証してセッションを確立し、URLを掃除する
  const token = searchParams.get("token")
  useEffect(() => {
    if (!token) return
    let cancelled = false
    void verifyMagicLink(token)
      .then((user) => {
        if (cancelled) return
        setSession(user)
        // 初期ロードの fetchTeams はマウント時に並行で走るため、magic-link 着地時は
        // セッション cookie 確立前に実行され isMember が全て false になっている。
        // ログイン確立後に取り直し、自チーム候補（isMember 由来）を正しく埋める。
        // あわせて reconciledRef を戻し、正しい isMember で reconcile を再実行させる
        // （参加が1チームだけなら自動選択する処理を、初回ログイン直後でも効かせるため）。
        // 前提: 初期ロードの fetchTeams（cookie 前・isMember 全 false）の方が先に解決すること。
        // ここは verifyMagicLink→fetchTeams の逐次2往復なので、並行で走る初期ロードより後に
        // 解決する＝後勝ちで正しい isMember を反映する想定。万一この順序が逆転すると stale な
        // isMember=false が上書きし、自動選択が効かなくなる（実際にはまず起きないが要注意）。
        void fetchTeams()
          .then((t) => {
            if (cancelled) return
            reconciledRef.current = false
            setTeams(t)
          })
          .catch(() => {})
      })
      .catch(() => {
        // 失効/使用済みトークン等。未ログインのまま続行（書き込み時にログイン案内が出る）
      })
      .finally(() => {
        if (cancelled) return
        // トークンをURLから除去（再読込・共有時の誤用を防ぐ）。team= は残す。
        cleanUrlKeepingTeam()
      })
    return () => {
      cancelled = true
    }
  }, [token, cleanUrlKeepingTeam])

  // 招待リンク着地: ?join= があれば参加トークンを sessionStorage に退避し、URLを掃除する。
  // （未ログインならログイン往復をまたぐため、ログイン後に実行する）
  const joinToken = searchParams.get("join")
  useEffect(() => {
    if (!joinToken) return
    try {
      window.sessionStorage.setItem(PENDING_JOIN_KEY, joinToken)
    } catch {
      // sessionStorage が使えない環境ではこの後の参加処理が走らないだけ
    }
    // join は消すが team= は残し、後段の ?team= 効果で対象チームを自チーム選択させる
    cleanUrlKeepingTeam()
  }, [joinToken, cleanUrlKeepingTeam])

  // 共有リンク着地: ?share= があれば共有トークンを sessionStorage に退避し、URLを掃除する（#175）。
  // join と同型。受諾の確認モーダルはログイン確立後（下の effect）に開く。
  const shareToken = searchParams.get("share")
  useEffect(() => {
    if (!shareToken) return
    try {
      window.sessionStorage.setItem(PENDING_SHARE_KEY, shareToken)
    } catch {
      // sessionStorage が使えない環境ではこの後の受諾処理が走らないだけ
    }
    // share / from を消す。team= は持たないリンクなので素のパスへ戻る
    cleanUrlKeepingTeam()
  }, [shareToken, cleanUrlKeepingTeam])

  // 初期ロード: セッション + チーム一覧
  useEffect(() => {
    let cancelled = false
    Promise.all([fetchSession().catch(() => null), fetchTeams()])
      .then(([s, t]) => {
        if (cancelled) return
        setSession((prev) => prev ?? s)
        setTeams(t)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoadError(true)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 初期ロード直後に1回だけ、復元した選択を整合させる。
  // - 自チーム: 所属チーム（isMember）以外（削除済み・別デバイスで脱退した残り等）は null に倒す。
  // - 相手チーム: 可視チーム一覧（所属 ∪ 共有相手・#175）に無い ID（削除済み・共有解除済み等）を取り除く。
  // 以降の参加・作成では意図的に有効なチームを選択するため、再実行しない（選択が消されるのを防ぐ）。
  // 例外: magic-link ログイン確立後の再取得時のみ reconciledRef を戻し、もう一度だけ走らせる（上の宣言箇所参照）。
  useEffect(() => {
    if (loading || reconciledRef.current) return
    reconciledRef.current = true
    const valid = new Set(teams.map((t) => t.teamId))
    const memberTeams = teams.filter((t) => t.isMember)
    const memberTeamIds = new Set(memberTeams.map((t) => t.teamId))
    // 自チームは所属チームのみ選べる。別デバイスで脱退した等で localStorage に残った
    // 非メンバー（または削除済み）のチームIDはここで null に倒す
    // （セレクタは空表示なのにグリッドだけ残る不整合を防ぐ）。
    let nextOwn = ownTeamId && !memberTeamIds.has(ownTeamId) ? null : ownTeamId
    const nextOpponents = opponentTeamIds.filter((id) => valid.has(id))
    // 自チーム未選択で、参加チームがちょうど1つだけならそれを自動選択する
    // （複数参加なら本人に選ばせるため自動選択しない）
    if (nextOwn === null && memberTeams.length === 1) {
      nextOwn = memberTeams[0].teamId
    }
    // 変化が無ければ書き戻さない（再実行は reconciledRef で止まるのでループ防止ではなく、無駄なストア書き込み＝余計な再レンダリングの抑制）
    if (nextOwn === ownTeamId && nextOpponents.length === opponentTeamIds.length) return
    setStoredSelection({ ownTeamId: nextOwn, opponentTeamIds: nextOpponents })
  }, [loading, teams, ownTeamId, opponentTeamIds])

  // 「参加済み」案内リンク・招待リンクからの着地: ?team=<teamId> があれば、そのチームを自チームに選択する。
  // （Discord の招待ボタンで既に参加済みだったユーザーをスケジュール画面に誘導する導線）
  // 自チームは「所属チーム」だけを選べるため、isMember=true のときだけ選択する
  // （非メンバーが共有リンク等で着地しても自チームには入れない＝セレクタは空なのにグリッドだけ出る不整合を防ぐ）。
  // setOwnTeamId 経由で localStorage にも永続化する。既に別チームが own 選択済みでも team= で上書きする（招待/誘導が優先）。
  // 最後に URL から team= を消すため teamParam が null になり、
  // 再実行時は冒頭で早期 return する＝自然に一度きりの処理になる（専用のガードフラグは不要）。
  const teamParam = searchParams.get("team")
  useEffect(() => {
    if (!teamParam || loading) return
    const target = teams.find((t) => t.teamId === teamParam)
    if (target?.isMember) {
      setOwnTeamId(teamParam)
    } else if (target) {
      // 存在はするが isMember=false。magic-link 着地直後やリンクからの参加直後は、
      // セッション確立・参加反映前の一覧で isMember が false のことがある。
      // ここでは URL を掃除せず待ち、再取得で teams が更新されれば本効果が再実行されて選択する。
      // 本当の非メンバーなら team= は残るが自チーム選択はされない（不整合は起きない）。
      return
    }
    // 選択済み or 存在しない（削除済み等）チーム: team= だけを除去し、他のクエリ（?setting=<tab> 等）は残す。全消ししないこと。
    const params = new URLSearchParams(window.location.search)
    params.delete("team")
    const qs = params.toString()
    router.replace(qs ? `/team_schedules?${qs}` : "/team_schedules")
  }, [teamParam, loading, teams, setOwnTeamId, router])

  // 予定取得: 選択中チーム + 参加チーム全てを先読みする（#165）。
  // 自チームに選べるのは参加チームだけなので、開いた時点で全参加チームを取得しておけば
  // 自チーム切替時のスピナーを無くせる。相手チームは選択時に取得し、以降はキャッシュを使う。
  // loading でガードしないのは意図的: 初期ロード中（teams が空）は memberIds が空になり ids=選択中チームだけになる。
  // localStorage 復元済みの選択中チームの予定を初期ロードと並行で取得し、view を loading 完了前に出すため
  // （下部カレンダーの「loading を待たず view 準備でき次第表示」コメント参照）。loading 完了で teams が入ると
  // deps 経由で再実行され、参加チーム全件を先読みする。
  useEffect(() => {
    const from = dayKeys[0]
    const to = dayKeys[dayKeys.length - 1]
    const memberIds = teams.filter((t) => t.isMember).map((t) => t.teamId)
    const selectedIds = [ownTeamId, ...opponentTeamIds].filter((id): id is string => !!id)
    const ids = Array.from(new Set([...selectedIds, ...memberIds]))
    ids.forEach((id) => {
      if (schedulesByTeam[id] || fetchingRef.current.has(id)) return
      fetchingRef.current.add(id)
      void fetchTeamSchedule(id, from, to)
        .then((team) => setSchedulesByTeam((prev) => ({ ...prev, [id]: team })))
        .catch(() => {})
        .finally(() => fetchingRef.current.delete(id))
    })
  }, [teams, ownTeamId, opponentTeamIds, dayKeys, schedulesByTeam])

  // ローカルの予定を更新（楽観的更新）
  const applyLocalEdit = useCallback((teamId: string, userId: string, day: string, status: CellStatus, note: string) => {
    setSchedulesByTeam((prev) => {
      const team = prev[teamId]
      if (!team) return prev
      const others = team.schedules.filter((s) => !(s.userId === userId && s.day === day))
      const scheduleStatus = toScheduleStatus(status)
      const next: ScheduleEntry[] = scheduleStatus === null ? others : [...others, { userId, day, status: scheduleStatus, note: note || null }]
      return { ...prev, [teamId]: { ...team, schedules: next } }
    })
  }, [])

  // 現在の note を取得するヘルパー
  const currentNote = useCallback(
    (teamId: string, userId: string, day: string): string => {
      const team = schedulesByTeam[teamId]
      return team?.schedules.find((s) => s.userId === userId && s.day === day)?.note ?? ""
    },
    [schedulesByTeam],
  )

  // 永続化（楽観的更新の書き込み側）。
  // catch の握りつぶしは【意図的】。安易に console.warn 追加や throw 伝播へ"修正"しないこと。
  // ここは applyLocalEdit で先に画面を更新済みのため、保存失敗時の正しい手当ては
  // 「楽観更新のロールバック or 再 fetch で再同期 + ユーザー通知」であって、ログ追加では片付かない。
  // それは設計判断を伴う重い変更なので別Issue（#158）送りとし、現状は握りつぶしのまま据え置く。
  // （非致命的な読み取りの reloadTeams の握りつぶし=warn可、とは性質が違う点に注意）
  const persist = useCallback((teamId: string, day: string, status: ScheduleStatus | null, note: string) => {
    if (status === null) {
      void deleteSchedule({ teamId, day }).catch(() => {})
    } else {
      void upsertSchedule({ teamId, day, status, note: note || null }).catch(() => {})
    }
  }, [])

  const openLogin = useCallback(() => {
    open(<LoginModal onClose={close} />)
  }, [open, close])

  // 使い方説明モーダル（md未満のヒントボタンから開く）
  const openHelp = useCallback(() => {
    open(<ScheduleHelpModal onClose={close} />)
  }, [open, close])

  // チーム一覧を再取得（作成・参加の直後に反映するため）
  const reloadTeams = useCallback(async () => {
    // 一覧の貼り直しはベストエフォート（呼び出し側は void で投げっぱなし）。失敗は非致命的
    // （前の一覧を維持・次の reload で自己回復）なので、ここで握って warn だけ残す。
    const list = await fetchTeams().catch((e) => {
      console.warn("reloadTeams: チーム一覧の再取得に失敗（前の一覧を維持）", e)
      return null
    })
    if (list) setTeams(list)
  }, [])

  // 退避済みの参加トークンを処理する。
  // - ログイン済み: そのまま参加 → チーム一覧を再取得して自チームに選択
  // - 未ログイン: ログイン案内を出す（ログイン後にこの effect が再実行される）
  useEffect(() => {
    if (loading) return
    let pending: string | null = null
    try {
      pending = window.sessionStorage.getItem(PENDING_JOIN_KEY)
    } catch {
      pending = null
    }
    if (!pending) return

    if (!session) {
      openLogin()
      return
    }

    let cancelled = false
    void joinTeam(pending)
      .then((team) => {
        if (cancelled) return
        try {
          window.sessionStorage.removeItem(PENDING_JOIN_KEY)
        } catch {
          // 失敗しても致命的ではない
        }
        void reloadTeams()
        setOwnTeamId(team.teamId)
        // 自チーム未選択なら参加チームを自チームに、選択済みなら相手候補として扱えるよう一覧更新のみ
      })
      .catch(() => {
        // 失効・無効トークン等。退避を消して諦める
        try {
          window.sessionStorage.removeItem(PENDING_JOIN_KEY)
        } catch {
          // noop
        }
      })
    return () => {
      cancelled = true
    }
  }, [loading, session, openLogin, reloadTeams, setOwnTeamId])

  // 退避済みの共有トークンを処理する（#175）。
  // - 未ログイン: ログイン案内（ログイン後に再実行される）
  // - ログイン済み: 確認情報を取得して受諾モーダルを開く。受諾成功で一覧を取り直し相手候補に反映。
  // モーダルを開く時点で退避を消す（キャンセル時は破棄＝再度リンクを踏めばやり直せる。join とは異なり確認ダイアログのため）。
  useEffect(() => {
    if (loading) return
    let pending: string | null = null
    try {
      pending = window.sessionStorage.getItem(PENDING_SHARE_KEY)
    } catch {
      pending = null
    }
    if (!pending) return

    if (!session) {
      openLogin()
      return
    }

    const token = pending
    let cancelled = false
    void fetchSharePreview(token)
      .then((preview) => {
        if (cancelled) return
        try {
          window.sessionStorage.removeItem(PENDING_SHARE_KEY)
        } catch {
          // 失敗しても致命的ではない
        }
        open(
          <ShareAcceptModal
            preview={preview}
            onClose={close}
            onAccept={async (acceptTeamId) => {
              await acceptShare(token, acceptTeamId)
              // 共有相手が増えるので一覧を取り直す（sharedTeamIds 更新で相手候補に出る）
              void reloadTeams()
            }}
          />,
        )
      })
      .catch(() => {
        // 失効・無効トークン等。退避を消して諦める
        try {
          window.sessionStorage.removeItem(PENDING_SHARE_KEY)
        } catch {
          // noop
        }
      })
    return () => {
      cancelled = true
    }
  }, [loading, session, openLogin, open, close, reloadTeams])

  // セルの状態トグル
  const handleCycle = useCallback(
    ({ teamId, userId, day, current }: { teamId: string; userId: string; day: string; current: CellStatus }) => {
      if (!session) {
        openLogin()
        return
      }
      const next = cycleStatus(current)
      const note = currentNote(teamId, userId, day)
      applyLocalEdit(teamId, userId, day, next, note)
      persist(teamId, day, toScheduleStatus(next), note)
    },
    [session, currentNote, applyLocalEdit, persist, openLogin],
  )

  // セルの時間メモ変更
  const handleNoteChange = useCallback(
    ({ teamId, userId, day, value }: { teamId: string; userId: string; day: string; value: string }) => {
      if (!session) {
        openLogin()
        return
      }
      const team = schedulesByTeam[teamId]
      const existing = team?.schedules.find((s) => s.userId === userId && s.day === day)
      // 状態が未記入のままメモだけ書いても保存対象が無いので、状態は維持する
      const status: CellStatus = existing?.status ?? "none"
      applyLocalEdit(teamId, userId, day, status, value)
      if (status !== "none") persist(teamId, day, status, value)
    },
    [session, schedulesByTeam, applyLocalEdit, persist, openLogin],
  )

  // チーム単位モード: ローカルの状態を更新（楽観的更新）
  const applyLocalTeamEdit = useCallback((teamId: string, day: string, status: CellStatus, note: string) => {
    setSchedulesByTeam((prev) => {
      const team = prev[teamId]
      if (!team) return prev
      const others = team.teamStatus.filter((s) => s.day !== day)
      const scheduleStatus = toScheduleStatus(status)
      const next = scheduleStatus === null ? others : [...others, { day, status: scheduleStatus, note: note || null }]
      return { ...prev, [teamId]: { ...team, teamStatus: next } }
    })
  }, [])

  // チーム単位モード: 現在の note を取得
  const currentTeamNote = useCallback(
    (teamId: string, day: string): string => {
      const team = schedulesByTeam[teamId]
      return team?.teamStatus.find((s) => s.day === day)?.note ?? ""
    },
    [schedulesByTeam],
  )

  // チーム単位モード: 永続化。catch の握りつぶしは【意図的】（persist と同じ理由・同じ別Issue #158）。
  // 安易に warn 追加や throw 伝播へ"修正"しない。手当ては楽観更新のロールバック/再同期+通知が必要。
  const persistTeam = useCallback((teamId: string, day: string, status: ScheduleStatus | null, note: string) => {
    if (status === null) {
      void deleteTeamStatus({ teamId, day }).catch(() => {})
    } else {
      void upsertTeamStatus({ teamId, day, status, note: note || null }).catch(() => {})
    }
  }, [])

  // チーム単位モード: セルの状態トグル
  const handleTeamCycle = useCallback(
    ({ teamId, day, current }: { teamId: string; day: string; current: CellStatus }) => {
      if (!session) {
        openLogin()
        return
      }
      const next = cycleStatus(current)
      const note = currentTeamNote(teamId, day)
      applyLocalTeamEdit(teamId, day, next, note)
      persistTeam(teamId, day, toScheduleStatus(next), note)
    },
    [session, currentTeamNote, applyLocalTeamEdit, persistTeam, openLogin],
  )

  // チーム単位モード: セルの時間メモ変更
  const handleTeamNoteChange = useCallback(
    ({ teamId, day, value }: { teamId: string; day: string; value: string }) => {
      if (!session) {
        openLogin()
        return
      }
      const team = schedulesByTeam[teamId]
      const existing = team?.teamStatus.find((s) => s.day === day)
      const status: CellStatus = existing?.status ?? "none"
      applyLocalTeamEdit(teamId, day, status, value)
      if (status !== "none") persistTeam(teamId, day, status, value)
    },
    [session, schedulesByTeam, applyLocalTeamEdit, persistTeam, openLogin],
  )

  // チーム作成モーダルを開く（作成後は一覧を更新して自チームに選択）
  const openCreate = useCallback(() => {
    // ログインは通っていてもチーム作成権限が無い場合は、作成フォームではなくプレリリース案内モーダルを出す
    if (!session?.canCreateTeam) {
      open(<CreateTeamRestrictedModal onClose={close} />)
      return
    }
    open(
      <CreateTeamModal
        onClose={close}
        onCreated={(team) => {
          void reloadTeams()
          setOwnTeamId(team.teamId)
          close()
        }}
      />,
    )
  }, [session, open, close, reloadTeams, setOwnTeamId])

  // 選択中の自チームで、ログインユーザーが admin 相当以上（master/admin）か
  const isOwnAdmin = useMemo(() => {
    if (!session || !ownTeamId) return false
    const ownTeam = schedulesByTeam[ownTeamId]
    return !!ownTeam?.members.some((m) => m.userId === session.userId && hasAdminAuthority(m.teamRole))
  }, [session, ownTeamId, schedulesByTeam])

  // 選択中の自チームで master か（master は脱退不可なので脱退ボタンの出し分けに使う）
  const isOwnMaster = useMemo(() => {
    if (!session || !ownTeamId) return false
    const ownTeam = schedulesByTeam[ownTeamId]
    return !!ownTeam?.members.some((m) => m.userId === session.userId && m.teamRole === "master")
  }, [session, ownTeamId, schedulesByTeam])

  // 招待リンクを発行して表示する
  const handleInvite = useCallback(async () => {
    if (!ownTeamId) return
    try {
      const { url, expiryDays } = await createInvite(ownTeamId)
      open(<InviteModal url={url} expiryDays={expiryDays} onClose={close} />)
    } catch {
      // 発行失敗時は何もしない（権限喪失など）
    }
  }, [ownTeamId, open, close])

  // 共有リンクを発行して表示する（#175・招待リンクと同型）
  const handleShareInvite = useCallback(async () => {
    if (!ownTeamId) return
    try {
      const { url, expiryDays } = await createShareInvite(ownTeamId)
      open(<InviteModal url={url} expiryDays={expiryDays} variant="share" onClose={close} />)
    } catch {
      // 発行失敗時は何もしない（権限喪失など）
    }
  }, [ownTeamId, open, close])

  // 共有を解除する（#175）。両者から見えなくなる旨を確認してから 1行削除し、一覧を取り直す。
  const handleUnshare = useCallback(
    (partnerTeamId: string, partnerName: string) => {
      if (!ownTeamId) return
      const teamId = ownTeamId
      open(
        <ConfirmModal
          title="スケジュール共有を解除"
          description={`「${partnerName}」とのスケジュール共有を解除します。\n解除すると、両チームから互いのスケジュールが見えなくなります。`}
          confirmLabel="共有を解除する"
          onConfirm={async () => {
            await deleteShare(teamId, partnerTeamId)
            void reloadTeams()
          }}
          onClose={close}
        />,
      )
    },
    [ownTeamId, open, close, reloadTeams],
  )

  // 選択中の自チームのメンバーか（チーム管理画面はメンバーなら開ける）
  const isOwnMember = useMemo(() => {
    if (!session || !ownTeamId) return false
    const ownTeam = schedulesByTeam[ownTeamId]
    return !!ownTeam?.members.some((m) => m.userId === session.userId)
  }, [session, ownTeamId, schedulesByTeam])

  // 選択中の自チームの共有相手（teamId + 名前）。teams 一覧の sharedTeamIds から名前を解決する（#175）
  const sharePartners = useMemo(() => {
    if (!ownTeamId) return []
    const ids = teams.find((t) => t.teamId === ownTeamId)?.sharedTeamIds ?? []
    const nameById = new Map(teams.map((t) => [t.teamId, t.name]))
    return ids.map((id) => ({ teamId: id, name: nameById.get(id) ?? "(不明なチーム)" }))
  }, [ownTeamId, teams])

  // 設定モーダルの開閉・タブ選択は URL クエリ（?setting=<tab>）で管理する。
  // open() の命令的呼び出しではなく派生値でインライン描画することで、保存後の再取得で
  // props（team/isAdmin）が常に最新になり、useOverlay のスナップショット陳腐化を避ける。
  // 呼び出し時点の最新クエリを window.location から読む（searchParams を deps に入れない流儀。教訓#134）。
  const openManage = useCallback(() => {
    const params = new URLSearchParams(window.location.search)
    params.set("setting", DEFAULT_SETTING_TAB)
    router.push(`/team_schedules?${params.toString()}`)
  }, [router])
  const closeManage = useCallback(() => {
    const params = new URLSearchParams(window.location.search)
    params.delete("setting")
    const qs = params.toString()
    router.replace(qs ? `/team_schedules?${qs}` : "/team_schedules")
  }, [router])
  // タブ切替は replace で行う（開く操作=push の戻る先はモーダルを閉じる状態。タブ移動は履歴に積まない）
  const changeSettingTab = useCallback(
    (tab: SettingTab) => {
      const params = new URLSearchParams(window.location.search)
      params.set("setting", tab)
      router.replace(`/team_schedules?${params.toString()}`)
    },
    [router],
  )

  // 管理画面で管理モードを変更した後、自チームを再取得してグリッドへ反映する。
  // ローカルで managementMode だけ書き換えると、対応する schedules/teamStatus を伴わず
  // 全セル未記入で表示されてしまうため、必ず再取得して丸ごと差し替える。
  const handleManageUpdated = useCallback(() => {
    if (!ownTeamId) return
    const from = dayKeys[0]
    const to = dayKeys[dayKeys.length - 1]
    void fetchTeamSchedule(ownTeamId, from, to)
      .then((team) => setSchedulesByTeam((prev) => ({ ...prev, [ownTeamId]: team })))
      .catch(() => {})
    void reloadTeams()
  }, [ownTeamId, dayKeys, reloadTeams])

  // 管理モーダルの「新規チーム作成」タブでチームを作成したとき: 一覧再取得＆作成チームを自チーム選択＆モーダルを閉じる
  const handleTeamCreatedInModal = useCallback(
    (team: TeamSummary) => {
      void reloadTeams()
      setOwnTeamId(team.teamId)
      closeManage()
    },
    [reloadTeams, setOwnTeamId, closeManage],
  )

  // 脱退: 「脱退」と入力させる確認モーダルを overlay で開く。master は移譲が必要な旨を案内してブロック
  const handleLeaveRequest = useCallback(() => {
    if (!ownTeamId) return
    const teamId = ownTeamId
    const teamName = schedulesByTeam[teamId]?.name ?? "このチーム"
    open(
      <ConfirmByTypingModal
        title="チームを脱退"
        description={`「${teamName}」から脱退します。\n再参加には招待リンクが必要です。`}
        confirmWord="脱退"
        confirmLabel="脱退する"
        blockedReason={isOwnMaster ? "あなたはこのチームの管理者（master）です。\n脱退するには、先に別のメンバーに管理者権限を渡してください。" : undefined}
        onConfirm={async () => {
          await leaveTeam(teamId)
          // 脱退後はそのチームが isMember=false になり自チーム候補から外れるため、
          // 選択を解除する（セレクタは空表示なのにグリッドだけ残る不整合を防ぐ）。
          // 自チーム選択は解除済みなので、その予定の再取得（handleManageUpdated）は不要。
          // 一覧だけ取り直して isMember を更新する（disband と同じ流儀）。
          setOwnTeamId(null)
          void reloadTeams()
          closeManage()
        }}
        onClose={close}
      />,
    )
  }, [ownTeamId, schedulesByTeam, isOwnMaster, open, close, reloadTeams, closeManage, setOwnTeamId])

  // master 継承: 「継承」と入力させる確認モーダルを overlay で開く（master 専用）。脱退・解散と同じ確認モーダル。
  // 継承先（heirUserId）は SettingModal の継承先セレクタで選んだメンバー。成功後は自分が admin に降格するため、
  // チームを取り直して新しいロールを画面へ反映し、モーダルを閉じる。
  const handleSuccessionRequest = useCallback(
    (heirUserId: string) => {
      if (!ownTeamId) return
      const teamId = ownTeamId
      const ownTeam = schedulesByTeam[teamId]
      const teamName = ownTeam?.name ?? "このチーム"
      const heirName = ownTeam?.members.find((m) => m.userId === heirUserId)?.displayName ?? "このメンバー"
      open(
        <ConfirmByTypingModal
          title="管理者（master）を継承"
          description={`「${teamName}」の管理者（master）を「${heirName}」に継承します。\n継承後、あなたは管理者（admin）になります。`}
          confirmWord="継承"
          confirmLabel="継承する"
          onConfirm={async () => {
            await succeedMaster(teamId, heirUserId)
            handleManageUpdated()
            closeManage()
          }}
          onClose={close}
        />,
      )
    },
    [ownTeamId, schedulesByTeam, open, close, handleManageUpdated, closeManage],
  )

  // チーム解散: 「解散」と入力させる確認モーダルを overlay で開く（master 専用・取り消し不可）。
  // 解散するとチームと紐づく全データ（メンバー・予定）が削除されるため、選択を解除して一覧を取り直す。
  const handleDisbandRequest = useCallback(() => {
    if (!ownTeamId) return
    const teamId = ownTeamId
    const teamName = schedulesByTeam[teamId]?.name ?? "このチーム"
    open(
      <ConfirmByTypingModal
        title="チームを解散"
        description={`「${teamName}」を解散します。\nチームと、紐づく全データ（メンバー・予定など）が完全に削除されます。\nこの操作は取り消せません。`}
        confirmWord="解散"
        confirmLabel="解散する"
        onConfirm={async () => {
          await disbandTeam(teamId)
          // 解散後はチーム自体が消える。自チーム選択を解除し、一覧を取り直してモーダルを閉じる
          // （削除済みチームの予定取得は走らせないため handleManageUpdated は呼ばない）。
          setOwnTeamId(null)
          void reloadTeams()
          closeManage()
        }}
        onClose={close}
      />,
    )
  }, [ownTeamId, schedulesByTeam, open, close, reloadTeams, closeManage, setOwnTeamId])

  // アカウント削除: 「削除」と入力させる確認モーダルを overlay で開く。いずれかのチームの master は移譲が必要な旨を案内してブロック
  const handleDeleteAccountRequest = useCallback(() => {
    const isMasterOfAnyTeam = teams.some((t) => t.isMaster)
    open(
      <ConfirmByTypingModal
        title="アカウント削除"
        description={"あなたのアカウントと、紐づく全データ（所属・予定など）を完全に削除します。\nこの操作は取り消せません。"}
        confirmWord="削除"
        confirmLabel="アカウントを削除"
        blockedReason={isMasterOfAnyTeam ? "管理者（master）を務めているチームがあります。\nアカウントを削除するには、先に別のメンバーに管理者権限を渡してください。" : undefined}
        onConfirm={async () => {
          await deleteAccount()
          // 削除後はセッションも失効済み。全状態を捨てて初期表示に戻すため再読み込みする
          window.location.href = "/team_schedules"
        }}
        onClose={close}
      />,
    )
  }, [teams, open, close])

  // ログアウト: 確認モーダルを overlay で開く。再ログインには Discord Bot のログインコマンドが必要な旨を案内する。
  // コマンド名は API の定数（COMMANDS）から引いて文言と実体のズレを防ぐ。
  const handleLogoutRequest = useCallback(() => {
    open(
      <ConfirmModal
        title="ログアウト"
        description={`ログアウトすると、再度ログインするには Discord Bot で /${COMMANDS.TEAM_SCHEDULE.LOGIN} を実行する必要があります。`}
        confirmLabel="ログアウトする"
        onConfirm={async () => {
          await logout()
          // セッション失効済み。全状態を捨てて未ログインの初期表示に戻すため再読み込みする
          window.location.href = "/team_schedules"
        }}
        onClose={close}
      />,
    )
  }, [open, close])

  // 設定モーダルは未ログインでも開ける（機能のイメージを持ってもらう）。未ログイン時はモーダル側で全入力・ボタンを
  // disabled にし、ログインを促すバナーを出す。チーム管理タブは team が無ければ案内のみ。
  // チーム管理タブで表示する自チーム（未選択・未取得なら undefined → モーダル側で案内表示）。
  const ownTeamForManage = ownTeamId ? schedulesByTeam[ownTeamId] : undefined
  const settingParam = searchParams.get("setting")
  // 有効なタブ値のときだけ開く。不正値は初期タブにフォールバック（描画用）し、URL は自己修復で正す。
  const settingTab: SettingTab = isSettingTab(settingParam) ? settingParam : DEFAULT_SETTING_TAB
  const showManage = isSettingTab(settingParam)

  // ?setting= の値が不正なケースは、宙に浮いた param を自己修復で掃除する（未ログインでも開けるので session は条件に含めない）。
  // deps には文字列 settingParam を使う（教訓#134）。
  useEffect(() => {
    if (settingParam === null) return
    if (!isSettingTab(settingParam)) closeManage()
  }, [settingParam, closeManage])

  // ビューモデル構築
  const view = useMemo(() => {
    const ownTeam = ownTeamId ? schedulesByTeam[ownTeamId] : undefined
    if (!ownTeam) return null

    // 相手チームは「自チームと共有しているチーム」だけを表示する（#175）。
    // 自チーム自身は除外し、別の自チームを選んでいた頃の stale な選択もここで弾く（共有外のグリッド表示を防ぐ）。
    const sharedSet = new Set(teams.find((t) => t.teamId === ownTeamId)?.sharedTeamIds ?? [])
    const opponents = opponentTeamIds
      .filter((id) => id !== ownTeamId && sharedSet.has(id))
      .map((id) => schedulesByTeam[id])
      .filter((t): t is TeamSchedule => !!t)
    const ownIndexed = indexSchedules(ownTeam.schedules)
    const oppIndexed = new Map(opponents.map((t) => [t.teamId, indexSchedules(t.schedules)]))

    // ログインユーザーがそのチームの admin 相当以上（master/admin）か
    const isAdminOf = (team: TeamSchedule): boolean => !!session && team.members.some((m) => m.userId === session.userId && hasAdminAuthority(m.teamRole))

    // チーム単位モードのチームを1列にまとめる（own/opponent 共通）
    const buildTeamColumn = (team: TeamSchedule, idPrefix: string): ScheduleColumn => {
      const indexed = indexTeamStatus(team.teamStatus)
      const cells = new Map<string, { status: CellStatus; note: string }>()
      for (const day of dayKeys) {
        const e = indexed.get(day)
        cells.set(day, { status: e?.status ?? "none", note: e?.note ?? "" })
      }
      return {
        id: `${idPrefix}:${team.teamId}`,
        label: team.name,
        kind: "team",
        teamId: team.teamId,
        editTargetUserId: null,
        editable: isAdminOf(team),
        cells,
      }
    }

    // 自チーム列: members モードはメンバーごと、team モードはチーム1列
    const memberColumns: ScheduleColumn[] =
      ownTeam.managementMode === "team"
        ? [buildTeamColumn(ownTeam, "ownteam")]
        : ownTeam.members.map((m) => {
            const cells = new Map<string, { status: CellStatus; note: string }>()
            for (const day of dayKeys) {
              const e = ownIndexed.get(m.userId)?.get(day)
              cells.set(day, { status: toCellStatus(e), note: e?.note ?? "" })
            }
            return {
              id: `own:${m.userId}`,
              label: m.displayName,
              kind: "own-member" as const,
              teamId: ownTeam.teamId,
              editTargetUserId: m.userId,
              editable: session?.userId === m.userId,
              cells,
            }
          })

    // 相手チーム列（1チーム1列）
    const opponentColumns: ScheduleColumn[] = opponents.map((team) => {
      // team モードの相手はチーム1列（admin なら編集可）
      if (team.managementMode === "team") {
        return buildTeamColumn(team, "opp")
      }

      // members モード: 自分が所属していれば自分の行を編集、非メンバーは集約表示
      const indexed = oppIndexed.get(team.teamId)!
      const isMember = !!session && team.members.some((m) => m.userId === session.userId)
      const editTargetUserId = isMember ? session!.userId : null
      const cells = new Map<string, { status: CellStatus; note: string }>()
      for (const day of dayKeys) {
        if (isMember) {
          // 自分が相手チームの所属（相手admin）なら、自分の行を直接表示・編集
          const e = indexed.get(session!.userId)?.get(day)
          cells.set(day, { status: toCellStatus(e), note: e?.note ?? "" })
        } else {
          // 閲覧者にはチームの集約ステータスを見せる
          const agg = aggregateDay(team, indexed, day)
          let note = ""
          for (const m of team.members) {
            const e = indexed.get(m.userId)?.get(day)
            if (e?.note) {
              note = e.note
              break
            }
          }
          cells.set(day, { status: summarizeTeamStatus(agg), note })
        }
      }
      return {
        id: `opp:${team.teamId}`,
        label: team.name,
        kind: "opponent" as const,
        teamId: team.teamId,
        editTargetUserId,
        editable: isMember,
        cells,
      }
    })

    // 行（日付）の集計
    const rows: GridRow[] = dates.map((date) => {
      const ownAgg = aggregateDay(ownTeam, ownIndexed, date.key)
      const oppActive = opponents.some((t) => aggregateDay(t, oppIndexed.get(t.teamId)!, date.key).active)
      return {
        date,
        okCount: ownAgg.okCount,
        maybeCount: ownAgg.maybeCount,
        memberCount: ownAgg.memberCount,
        ownActive: ownAgg.active,
        impossible: ownAgg.impossible,
        success: ownAgg.active && oppActive,
      }
    })

    // team モードは単一状態（ok=活動可能）なので閾値は 1
    const threshold = ownTeam.managementMode === "team" ? 1 : ownTeam.requiredCount
    return { memberColumns, opponentColumns, rows, threshold, managementMode: ownTeam.managementMode, ownTeamName: ownTeam.name }
  }, [ownTeamId, opponentTeamIds, schedulesByTeam, dates, dayKeys, session, teams])

  // 自分が1つでもチームに所属しているか（teams 一覧の isMember 由来）。md以下で「チームを作成」ボタンを隠す判定に使う。
  const belongsToAnyTeam = useMemo(() => teams.some((t) => t.isMember), [teams])

  // ヘッダー右端のログイン表示（team_schedules 固有）。LolHeader には rightSlot で渡す。
  // 初期ロード中（session 未確定）はログインボタンを出さない（loading 中は null）。
  // 確定後はログイン済みならユーザー名、未ログインならログインボタンを表示する。
  const loginSlot = session?.displayName ? (
    <span className="flex items-center gap-1.5 truncate text-sm text-zinc-300" title={session.displayName}>
      <span aria-hidden="true">👤</span>
      <span className="truncate">{session.displayName}</span>
    </span>
  ) : loading ? null : (
    <button type="button" onClick={openLogin} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
      ログイン
    </button>
  )

  // ビューポート枠（h-dvh の flex 縦積み等）は layout.tsx に移設済み。ここはその中身（ヘッダー＋body）を返す。
  return (
    <>
      <div className="shrink-0">
        <LolHeader rightSlot={loginSlot} />
      </div>
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col p-2.5 md:p-6 lg:block gap-1.5">
        <div className="flex shrink-0 flex-wrap items-start justify-between md:gap-2">
          <div className="flex min-w-0 flex-1 items-start md:gap-2">
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight text-zinc-100">チーム活動 スケジュール調整</h1>
              <p className="mt-0.5 text-sm text-zinc-400">メンバーの参加可能日から、スクリム相手を探す</p>
            </div>
            {/* md以下: 設定をタイトル右に置いて縦スペースを節約する（md以上は右側のボタン群に表示）。
                ml-auto で右端へ寄せ、タイトル側の幅を確保する。
                設定は未ログインでも開ける（中身は disabled で見せ、ログインを促す）。 */}

            <div className="ml-auto flex shrink-0 items-center gap-2 md:hidden">
              {/* たたむボタン: 設定ボタンの左。表以外（チーム選択・凡例）を畳んで表に縦スペースを譲る（#156） */}
              <button
                type="button"
                onClick={toggleChrome}
                aria-label={chromeCollapsed ? "チーム選択・凡例を開く" : "チーム選択・凡例をたたむ"}
                aria-expanded={!chromeCollapsed}
                title={chromeCollapsed ? "開く" : "たたむ"}
                className="rounded-lg border border-zinc-600 bg-zinc-900 p-1.5 text-zinc-200 hover:bg-zinc-800"
              >
                <CollapseIcon collapsed={chromeCollapsed} className="h-5 w-5 fill-current" />
              </button>
              <button type="button" onClick={openManage} aria-label="設定" title="設定" className="rounded-lg border border-zinc-600 bg-zinc-900 p-1.5 text-zinc-200 hover:bg-zinc-800">
                <SettingsIcon className="h-5 w-5 fill-current" />
              </button>
            </div>
          </div>
          <ScrollFadeRow>
            <div className="flex w-max items-center gap-2">
              {/* スマホ時のみ: 表 ↔ カード切替（選択は localStorage に永続化）。一旦コメントアウト中（常に表表示）。
            {isPhone && (
              <div className="flex overflow-hidden rounded-lg border border-zinc-600 text-sm">
                <button
                  type="button"
                  onClick={() => setStoredViewMode("table")}
                  aria-pressed={viewMode === "table"}
                  className={"px-2.5 py-1.5 font-medium " + (viewMode === "table" ? "bg-indigo-600 text-white" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800")}
                >
                  表
                </button>
                <button
                  type="button"
                  onClick={() => setStoredViewMode("card")}
                  aria-pressed={viewMode === "card"}
                  className={"border-l border-zinc-600 px-2.5 py-1.5 font-medium " + (viewMode === "card" ? "bg-indigo-600 text-white" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800")}
                >
                  カード
                </button>
              </div>
            )}
            */}
              {/* 招待リンク発行はチーム管理モーダルの「今のチーム」タブに移設した */}
              {/* チームを作成: ログイン中なら全員に表示する（作成権限が無い場合は押下時にプレリリース案内モーダルを出す）。
                  md以下では既に所属チームがあるなら隠す（縦スペース確保。md以上は常に表示） */}
              {session && (
                <button
                  type="button"
                  onClick={openCreate}
                  className={"shrink-0 whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500" + (belongsToAnyTeam ? " hidden md:inline-block" : "")}
                >
                  チームを作成
                </button>
              )}
              {/* たたむボタン: 設定ボタンの左。md〜lg未満（縦圧縮レイアウト）でのみ表示（#156） */}
              <button
                type="button"
                onClick={toggleChrome}
                aria-label={chromeCollapsed ? "チーム選択・凡例を開く" : "チーム選択・凡例をたたむ"}
                aria-expanded={!chromeCollapsed}
                title={chromeCollapsed ? "開く" : "たたむ"}
                className="hidden shrink-0 rounded-lg border border-zinc-600 bg-zinc-900 p-1.5 text-zinc-200 hover:bg-zinc-800 md:inline-flex lg:hidden"
              >
                <CollapseIcon collapsed={chromeCollapsed} className="h-5 w-5 fill-current" />
              </button>
              {/* 設定は md以上のみここに表示（md以下はタイトル右に配置済み）。チーム作成より右に置く。未ログインでも開ける（中身は disabled で見せる） */}
              <button
                type="button"
                onClick={openManage}
                aria-label="設定"
                title="設定"
                className="hidden shrink-0 rounded-lg border border-zinc-600 bg-zinc-900 p-1.5 text-zinc-200 hover:bg-zinc-800 md:inline-flex"
              >
                <SettingsIcon className="h-5 w-5 fill-current" />
              </button>
            </div>
          </ScrollFadeRow>
        </div>

        {loadError && (
          <div className="mt-3 shrink-0 rounded-lg border border-rose-800 bg-rose-950/50 px-3 py-2 text-xs text-rose-300">データの読み込みに失敗しました。時間をおいて再読み込みしてください。</div>
        )}

        {/* チーム選択・凡例の折りたたみ領域（#156）。grid-rows 0fr↔1fr で高さを上下スライドアニメーション。
            lg以上は常に展開（トグルも非表示）。inner は overflow-hidden で畳み時に中身を隠す。 */}
        <div
          className={"grid shrink-0 transition-[grid-template-rows] duration-300 ease-in-out lg:grid-rows-[1fr] " + (chromeCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]")}
          onTransitionEnd={(e) => {
            // 展開アニメ完了時のみ overflow を可視化（ドロップダウンが領域外へ出られるように）
            if (e.propertyName === "grid-template-rows" && !chromeCollapsed) setChromeOverflowVisible(true)
          }}
        >
          <div className={"min-h-0 " + (chromeOverflowVisible ? "overflow-visible" : "overflow-hidden")}>
            <div className="flex flex-col md:gap-3 gap-1.5">
              <TeamCompareSelector teams={teams} ownTeamId={ownTeamId} opponentTeamIds={opponentTeamIds} onOwnTeamChange={setOwnTeamId} onOpponentsChange={setOpponentTeamIds} onOpenShareSetting={openManage} />
              {view && <ControlBar threshold={view.threshold} managementMode={view.managementMode} />}
            </div>
          </div>
        </div>

        <div className=" flex min-h-0 flex-1 flex-col overflow-hidden lg:block lg:flex-none lg:overflow-visible">
          {/* カレンダーは session/teams の完了（loading）を待たず、選択中チームの予定（view）が
              用意でき次第すぐ表示する。view 未準備かつ自チーム選択済みなら取得中スピナー、
              未選択で読み込み完了済みなら選択を促す（教訓: 体感速度のため不要な待ちを挟まない）。 */}
          {view ? (
            viewMode === "card" ? (
              <ScheduleDayCards
                rows={view.rows}
                threshold={view.threshold}
                opponentColumns={view.opponentColumns}
                memberColumns={view.memberColumns}
                onCycle={handleCycle}
                onNoteChange={handleNoteChange}
                onTeamCycle={handleTeamCycle}
                onTeamNoteChange={handleTeamNoteChange}
              />
            ) : (
              <ScheduleGrid
                rows={view.rows}
                threshold={view.threshold}
                opponentColumns={view.opponentColumns}
                memberColumns={view.memberColumns}
                ownTeamName={view.ownTeamName}
                onCycle={handleCycle}
                onNoteChange={handleNoteChange}
                onTeamCycle={handleTeamCycle}
                onTeamNoteChange={handleTeamNoteChange}
              />
            )
          ) : ownTeamId || loading ? (
            // 自チーム選択済み（予定の取得待ち）または初期ロード中はスピナー
            <p className="text-sm text-zinc-400">読み込み中…</p>
          ) : (
            <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-8 text-center text-sm text-zinc-400">自チームを選択すると日程グリッドが表示されます。</p>
          )}
        </div>

        {/* 使い方ヒントは全サイズでボタンに統一し、タップで説明モーダルを開く（md以上の全文インライン表示は廃止） */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={openHelp}
            className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
          >
            <span aria-hidden>💡</span>
            使い方ヒント
          </button>
        </div>
      </div>

      {/* 設定モーダル（?setting=<tab> で表示）。ログイン中なら誰でも開ける。useOverlay とは別に、URL 由来で直接描画する */}
      {showManage && (
        <>
          {/*
            z-30 に揃える（ヘッダー z-50 / ハンバーガーのドロワーパネル z-40 より必ず後ろ）。
            これでモーダルを開いてもヘッダー・メニューは前面に残る（LolHeader 参照）。
            なおドロワーの backdrop も同じ z-30（LolHeader）。両者の同時表示は想定しないため
            同値で許容している（重なり順は DOM 順依存になるが実害なし）。
          */}
          {/* 半透明背景（クリックで閉じる） */}
          <div className="fixed inset-0 z-30 h-full w-full bg-zinc-500/70" onClick={closeManage} />
          {/*
            md 以下はヘッダーを隠さないよう、ヘッダー下端から開始する全画面モーダル。top-* は LolHeader のスマホ時の高さに合わせる（#155）。
            スマホ時のヘッダー高さは、ログイン中（最大要素がハンバーガー）より未ログイン時（最大要素がログインボタン）の方がやや高い。
            あえて低い方（ログイン中）に合わせ、高い側のときはモーダル上端がヘッダー(z-50)の背後に隠れる側へ倒す
            （高い方に合わせると逆にログイン中でヘッダー下に背景スキマが見えるため）。
            ヘッダーは fixed ではなく in-flow（relative z-50）なので、ヘッダーの padding/高さを
            変えたらこの top-* も追従させること（ズレてもモーダルは z-30 でヘッダー背後に回るだけ）。
            md 以上は inset-0 で中央カード。カード外クリックを背景に通すため pointer-events-none、
            コンテンツのみ有効化（OverlayProvider と同じ流儀）。
          */}
          <div className="pointer-events-none fixed inset-x-0 bottom-0 top-11 z-30 flex items-center justify-center md:inset-0">
            <div className="pointer-events-auto h-full w-full md:h-auto md:w-auto">
              <SettingModal
                isLoggedIn={!!session}
                onLogin={openLogin}
                team={ownTeamForManage ?? null}
                isAdmin={isOwnAdmin}
                isMember={isOwnMember}
                isMaster={isOwnMaster}
                canCreate={!!session?.canCreateTeam}
                tab={settingTab}
                onTabChange={changeSettingTab}
                onClose={closeManage}
                onUpdated={handleManageUpdated}
                onCreated={handleTeamCreatedInModal}
                onInvite={() => void handleInvite()}
                sharePartners={sharePartners}
                onShareInvite={() => void handleShareInvite()}
                onUnshare={handleUnshare}
                onLeave={handleLeaveRequest}
                onSucceed={handleSuccessionRequest}
                onDisband={handleDisbandRequest}
                onLogout={handleLogoutRequest}
                onDeleteAccount={handleDeleteAccountRequest}
              />
            </div>
          </div>
        </>
      )}

      <DbHealthButton />
    </>
  )
}
