"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useOverlay } from "@/app/_client/lib/modal/ModalContext"
import type { ScheduleEntry, ScheduleStatus, SessionUser, TeamSchedule, TeamSummary } from "@/app/_domains/teamSchedules/types"
import { deleteSchedule, fetchSession, fetchTeamSchedule, fetchTeams, upsertSchedule } from "@/app/_domains/teamSchedules/_client/teamSchedulesApiClient"
import type { CellStatus, GridRow, ScheduleColumn } from "../_types"
import { aggregateDay, buildDateRange, cycleStatus, indexSchedules, summarizeTeamStatus, toCellStatus, toScheduleStatus } from "../_utils"
import { buildMockData } from "../_mockData"
import { ControlBar } from "./ControlBar"
import { LoginModal } from "./LoginModal"
import { ScheduleGrid } from "./ScheduleGrid"
import { TeamCompareSelector } from "./TeamCompareSelector"

const NUM_DAYS = 14

export function TeamSchedulesPage() {
  const { open, close } = useOverlay()

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
  const [ownTeamId, setOwnTeamId] = useState<string | null>(null)
  const [opponentTeamIds, setOpponentTeamIds] = useState<string[]>([])
  const [usingMock, setUsingMock] = useState(false)
  const [loading, setLoading] = useState(true)

  // 初期ロード: セッション + チーム一覧。失敗したらモックにフォールバック
  useEffect(() => {
    let cancelled = false
    Promise.all([fetchSession().catch(() => null), fetchTeams()])
      .then(([s, t]) => {
        if (cancelled) return
        setSession(s)
        setTeams(t)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        // API未接続: モックデータで表示
        const mock = buildMockData(dayKeys)
        setSession(mock.session)
        setTeams(mock.teams)
        setSchedulesByTeam(mock.schedulesByTeam)
        setOwnTeamId("own")
        setOpponentTeamIds(["opp-a", "opp-b"])
        setUsingMock(true)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [dayKeys])

  // 選択中チームの予定を取得（実API接続時のみ）
  useEffect(() => {
    if (usingMock) return
    const ids = [ownTeamId, ...opponentTeamIds].filter((id): id is string => !!id)
    const from = dayKeys[0]
    const to = dayKeys[dayKeys.length - 1]
    ids.forEach((id) => {
      if (schedulesByTeam[id]) return
      void fetchTeamSchedule(id, from, to)
        .then((team) => setSchedulesByTeam((prev) => ({ ...prev, [id]: team })))
        .catch(() => {})
    })
  }, [usingMock, ownTeamId, opponentTeamIds, dayKeys, schedulesByTeam])

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

  // 永続化（モック時はスキップ）
  const persist = useCallback(
    (teamId: string, day: string, status: ScheduleStatus | null, note: string) => {
      if (usingMock) return
      if (status === null) {
        void deleteSchedule({ teamId, day }).catch(() => {})
      } else {
        void upsertSchedule({ teamId, day, status, note: note || null }).catch(() => {})
      }
    },
    [usingMock],
  )

  const openLogin = useCallback(() => {
    open(<LoginModal onClose={close} />)
  }, [open, close])

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

  // ビューモデル構築
  const view = useMemo(() => {
    const ownTeam = ownTeamId ? schedulesByTeam[ownTeamId] : undefined
    if (!ownTeam) return null

    const opponents = opponentTeamIds.map((id) => schedulesByTeam[id]).filter((t): t is TeamSchedule => !!t)
    const ownIndexed = indexSchedules(ownTeam.schedules)
    const oppIndexed = new Map(opponents.map((t) => [t.teamId, indexSchedules(t.schedules)]))

    // 自メンバー列
    const memberColumns: ScheduleColumn[] = ownTeam.members.map((m) => {
      const cells = new Map<string, { status: CellStatus; note: string }>()
      for (const day of dayKeys) {
        const e = ownIndexed.get(m.userId)?.get(day)
        cells.set(day, { status: toCellStatus(e), note: e?.note ?? "" })
      }
      return {
        id: `own:${m.userId}`,
        label: m.displayName,
        kind: "own-member",
        teamId: ownTeam.teamId,
        editTargetUserId: m.userId,
        editable: session?.userId === m.userId,
        cells,
      }
    })

    // 相手チーム列（1チーム1列・代表ステータスに集約）
    const opponentColumns: ScheduleColumn[] = opponents.map((team) => {
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
        kind: "opponent",
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

    return { memberColumns, opponentColumns, rows, threshold: ownTeam.requiredCount }
  }, [ownTeamId, opponentTeamIds, schedulesByTeam, dates, dayKeys, session])

  return (
    <div className="min-h-screen bg-slate-50 p-3 text-slate-800 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-lg font-bold tracking-tight text-slate-900">スクリム調整</h1>
        <p className="mt-0.5 text-sm text-slate-500">必要人数そろって、相手も空いてる日を探す</p>

        {usingMock && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            モックデータを表示中（サーバーAPI未接続）。実装が接続されると実データに切り替わります。
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
            <p className="text-sm text-slate-400">読み込み中…</p>
          ) : !view ? (
            <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
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
            />
          )}
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          ※ セルをタップで 未記入→○→△→× を循環。○数が必要人数以上かつ相手が空いている日が「成立」。×が増えて必要人数に届かない確定の日は行を薄く表示。相手の不可セルは薄く表示。時間は自由記入のため、○数は時間の重なりまでは見ていません。
        </p>
      </div>
    </div>
  )
}
