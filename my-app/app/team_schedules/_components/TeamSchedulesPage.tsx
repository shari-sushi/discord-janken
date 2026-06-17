"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import LolHeader from "@/app/lol/_components/LolHeader"
import { useOverlay } from "@/app/_client/lib/modal/ModalContext"
import type { ScheduleEntry, ScheduleStatus, SessionUser, TeamSchedule, TeamSummary } from "@/app/_domains/teamSchedules/types"
import { hasAdminAuthority } from "@/app/_domains/teamSchedules/types"
import {
  createInvite,
  deleteSchedule,
  deleteTeamStatus,
  fetchSession,
  fetchTeamSchedule,
  fetchTeams,
  joinTeam,
  upsertSchedule,
  upsertTeamStatus,
  verifyMagicLink,
} from "@/app/_domains/teamSchedules/_client/teamSchedulesApiClient"
import type { CellStatus, GridRow, ScheduleColumn } from "../_types"
import { aggregateDay, buildDateRange, cycleStatus, indexSchedules, indexTeamStatus, summarizeTeamStatus, toCellStatus, toScheduleStatus } from "../_utils"
import { setStoredSelection, useStoredSelection } from "../_selectionStore"
import { ControlBar } from "./ControlBar"
import { CreateTeamModal } from "./CreateTeamModal"
import { DbHealthButton } from "./DbHealthButton"
import { InviteModal } from "./InviteModal"
import { LoginModal } from "./LoginModal"
import { ScheduleGrid } from "./ScheduleGrid"
import { TeamCompareSelector } from "./TeamCompareSelector"
import { TeamManageModal } from "./TeamManageModal"

const NUM_DAYS = 14

/** 招待リンクからの参加トークンを、ログイン往復をまたいで保持する sessionStorage キー */
const PENDING_JOIN_KEY = "ts_pending_join"

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
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

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

  // 初期ロード直後に1回だけ、復元した選択のうちチーム一覧に存在しないチームを取り除く。
  // チーム一覧は public read で全チームを返すため、ここで消えるのは DB から削除されたチームのみ
  // （非メンバーでも閲覧できるので「権限喪失」では消えない）。
  // 以降の参加・作成では意図的に有効なチームを選択するため、再実行しない（選択が消されるのを防ぐ）。
  const reconciledRef = useRef(false)
  useEffect(() => {
    if (loading || reconciledRef.current) return
    reconciledRef.current = true
    const valid = new Set(teams.map((t) => t.teamId))
    const nextOwn = ownTeamId && !valid.has(ownTeamId) ? null : ownTeamId
    const nextOpponents = opponentTeamIds.filter((id) => valid.has(id))
    // 変化が無ければ書き戻さない（再実行は reconciledRef で止まるのでループ防止ではなく、無駄なストア書き込み＝余計な再レンダリングの抑制）
    if (nextOwn === ownTeamId && nextOpponents.length === opponentTeamIds.length) return
    setStoredSelection({ ownTeamId: nextOwn, opponentTeamIds: nextOpponents })
  }, [loading, teams, ownTeamId, opponentTeamIds])

  // 「参加済み」案内リンク・招待リンクからの着地: ?team=<teamId> があれば、そのチームを自チームに選択する。
  // （Discord の招待ボタンで既に参加済みだったユーザーをスケジュール画面に誘導する導線）
  // チーム一覧（public read で全チーム返す）の取得後に存在チェックし、setOwnTeamId 経由で
  // localStorage にも永続化する。既に別チームが own 選択済みでも team= で上書きする（招待/誘導が優先）。
  // 最後に URL から team= を消すため teamParam が null になり、
  // 再実行時は冒頭で早期 return する＝自然に一度きりの処理になる（専用のガードフラグは不要）。
  const teamParam = searchParams.get("team")
  useEffect(() => {
    if (!teamParam || loading) return
    // 存在しない（削除済み等）チームIDは無視し、URLだけ掃除する
    if (teams.some((t) => t.teamId === teamParam)) {
      setOwnTeamId(teamParam)
    }
    // team= だけを除去し、他のクエリ（?manage=1 等）は残す。全消ししないこと。
    const params = new URLSearchParams(window.location.search)
    params.delete("team")
    const qs = params.toString()
    router.replace(qs ? `/team_schedules?${qs}` : "/team_schedules")
  }, [teamParam, loading, teams, setOwnTeamId, router])

  // 選択中チームの予定を取得
  useEffect(() => {
    const ids = [ownTeamId, ...opponentTeamIds].filter((id): id is string => !!id)
    const from = dayKeys[0]
    const to = dayKeys[dayKeys.length - 1]
    ids.forEach((id) => {
      if (schedulesByTeam[id]) return
      void fetchTeamSchedule(id, from, to)
        .then((team) => setSchedulesByTeam((prev) => ({ ...prev, [id]: team })))
        .catch(() => {})
    })
  }, [ownTeamId, opponentTeamIds, dayKeys, schedulesByTeam])

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

  // 永続化
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

  // チーム一覧を再取得（作成・参加の直後に反映するため）
  const reloadTeams = useCallback(async () => {
    const list = await fetchTeams().catch(() => null)
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

  // チーム単位モード: 永続化
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
  }, [open, close, reloadTeams, setOwnTeamId])

  // 選択中の自チームで、ログインユーザーが admin 相当以上（master/admin）か
  const isOwnAdmin = useMemo(() => {
    if (!session || !ownTeamId) return false
    const ownTeam = schedulesByTeam[ownTeamId]
    return !!ownTeam?.members.some((m) => m.userId === session.userId && hasAdminAuthority(m.teamRole))
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

  // 選択中の自チームのメンバーか（チーム管理画面はメンバーなら開ける）
  const isOwnMember = useMemo(() => {
    if (!session || !ownTeamId) return false
    const ownTeam = schedulesByTeam[ownTeamId]
    return !!ownTeam?.members.some((m) => m.userId === session.userId)
  }, [session, ownTeamId, schedulesByTeam])

  // チーム管理モーダルの開閉は URL クエリ（?manage=1）で管理する。
  // open() の命令的呼び出しではなく派生値でインライン描画することで、保存後の再取得で
  // props（team/isAdmin）が常に最新になり、useOverlay のスナップショット陳腐化を避ける。
  // 呼び出し時点の最新クエリを window.location から読む（searchParams を deps に入れない流儀。教訓#134）。
  const openManage = useCallback(() => {
    const params = new URLSearchParams(window.location.search)
    params.set("manage", "1")
    router.push(`/team_schedules?${params.toString()}`)
  }, [router])
  const closeManage = useCallback(() => {
    const params = new URLSearchParams(window.location.search)
    params.delete("manage")
    const qs = params.toString()
    router.replace(qs ? `/team_schedules?${qs}` : "/team_schedules")
  }, [router])

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

  // ?manage=1 のとき、自チームが読み込み済み かつ メンバーであれば管理モーダルを表示する
  const ownTeamForManage = ownTeamId ? schedulesByTeam[ownTeamId] : undefined
  const manageParam = searchParams.get("manage")
  const showManage = manageParam === "1" && !!ownTeamForManage && isOwnMember

  // ?manage=1 が共有/ブックマーク等で来たが開けないケース（自チーム未選択 or 読込済みで非メンバー）は、
  // 宙に浮いた param を自己修復で掃除する。取得待ち（ownTeamId はあるが ownTeamForManage 未取得）は
  // 正当な表示待ちなので対象外（誤って閉じない）。deps には searchParams ではなく文字列 manageParam を使う（教訓#134）。
  useEffect(() => {
    if (manageParam !== "1" || loading) return
    if (!ownTeamId || (ownTeamForManage && !isOwnMember)) closeManage()
  }, [manageParam, loading, ownTeamId, ownTeamForManage, isOwnMember, closeManage])

  // ビューモデル構築
  const view = useMemo(() => {
    const ownTeam = ownTeamId ? schedulesByTeam[ownTeamId] : undefined
    if (!ownTeam) return null

    const opponents = opponentTeamIds.map((id) => schedulesByTeam[id]).filter((t): t is TeamSchedule => !!t)
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
    return { memberColumns, opponentColumns, rows, threshold }
  }, [ownTeamId, opponentTeamIds, schedulesByTeam, dates, dayKeys, session])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <LolHeader userName={session?.displayName ?? null} onLogin={openLogin} />
      <div className="mx-auto max-w-6xl p-3 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-zinc-100">チーム活動 スケジュール調整</h1>
            <p className="mt-0.5 text-sm text-zinc-400">必要人数そろって、相手も空いてる日を探す</p>
          </div>
          <div className="flex items-center gap-2">
            {isOwnMember && (
              <button
                type="button"
                onClick={openManage}
                className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
              >
                チーム管理
              </button>
            )}
            {isOwnAdmin && (
              <button
                type="button"
                onClick={() => void handleInvite()}
                className="rounded-lg border border-indigo-500 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-indigo-300 hover:bg-zinc-800"
              >
                招待リンクを発行
              </button>
            )}
            {session?.canCreateTeam && (
              <button type="button" onClick={openCreate} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
                チームを作成
              </button>
            )}
          </div>
        </div>

        {loadError && (
          <div className="mt-3 rounded-lg border border-rose-800 bg-rose-950/50 px-3 py-2 text-xs text-rose-300">
            データの読み込みに失敗しました。時間をおいて再読み込みしてください。
          </div>
        )}

        <div className="mt-3 flex flex-col gap-3">
          <TeamCompareSelector
            teams={teams}
            ownTeamId={ownTeamId}
            opponentTeamIds={opponentTeamIds}
            onOwnTeamChange={setOwnTeamId}
            onOpponentsChange={setOpponentTeamIds}
          />
          {view && <ControlBar threshold={view.threshold} />}
        </div>

        <div className="mt-3">
          {loading ? (
            <p className="text-sm text-zinc-400">読み込み中…</p>
          ) : !view ? (
            <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-8 text-center text-sm text-zinc-400">
              自チームを選択すると日程グリッドが表示されます。
            </p>
          ) : (
            <ScheduleGrid
              rows={view.rows}
              threshold={view.threshold}
              opponentColumns={view.opponentColumns}
              memberColumns={view.memberColumns}
              onCycle={handleCycle}
              onNoteChange={handleNoteChange}
              onTeamCycle={handleTeamCycle}
              onTeamNoteChange={handleTeamNoteChange}
            />
          )}
        </div>

        <p className="mt-3 text-xs leading-relaxed text-zinc-400">
          ※ セルをタップで 未記入→○→△→× を循環。○数が必要人数以上かつ相手が空いている日が「成立」。×が増えて必要人数に届かない確定の日は行を薄く表示。相手の不可セルは薄く表示。チーム単位モードのチームは管理者が1列でまとめて入力します。時間は自由記入のため、○数は時間の重なりまでは見ていません。
        </p>
      </div>

      {/* チーム管理モーダル（?manage=1 で表示）。useOverlay とは別に、URL 由来で直接描画する */}
      {showManage && ownTeamForManage && (
        <>
          {/* 全画面の半透明背景（クリックで閉じる）。md 以下は全画面モーダルが覆うため実質ページ */}
          <div className="fixed inset-0 z-40 h-full w-full bg-zinc-500/70" onClick={closeManage} />
          {/* lg では中央カード外クリックを背景に通すため pointer-events-none、コンテンツのみ有効化（OverlayProvider と同じ流儀） */}
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
            <div className="pointer-events-auto">
              <TeamManageModal team={ownTeamForManage} isAdmin={isOwnAdmin} onClose={closeManage} onUpdated={handleManageUpdated} />
            </div>
          </div>
        </>
      )}

      <DbHealthButton />
    </div>
  )
}
