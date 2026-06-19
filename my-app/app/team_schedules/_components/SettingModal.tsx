"use client"

import { useState } from "react"
import { DEFAULT_REQUIRED_COUNT, MIN_REQUIRED_COUNT, REQUIRED_COUNT_LABEL, type TeamManagementMode, type TeamSchedule, type TeamSummary } from "@/app/_domains/teamSchedules/types"

/**
 * 設定モーダルのタブ識別子。URL クエリ `?setting=<tab>` の値としても使う（共有・リロードで復元）。
 * 値は意味の分かる英語にし、表示ラベル（日本語）とは分離する。
 */
export type SettingTab = "team-management" | "team-creation" | "global-settings"

/** 設定モーダルを開いたときの初期タブ */
export const DEFAULT_SETTING_TAB: SettingTab = "team-management"

/** URL から来た文字列が有効なタブか（不正値は弾いて初期タブにフォールバックする） */
export function isSettingTab(value: string | null): value is SettingTab {
  return value === "team-management" || value === "team-creation" || value === "global-settings"
}
import { updateTeam } from "@/app/_domains/teamSchedules/_client/teamSchedulesApiClient"
import { CreateTeamForm } from "./CreateTeamForm"
import { CREATE_TEAM_RESTRICTED_MESSAGE } from "./CreateTeamRestrictedModal"
import { CloseIcon } from "./CloseIcon"

type SettingModalProps = {
  /**
   * ログイン済みか。未ログインでもモーダルは開けるが（機能のイメージを持ってもらうため）、
   * その場合あらゆる入力・ボタンを disabled にし、ログインを促すバナーを出す。
   */
  isLoggedIn: boolean
  /** 未ログインバナーのログインボタン押下時（親がログインモーダルを開く） */
  onLogin: () => void
  /** 選択中の自チーム。未選択（または未取得）なら null＝チーム管理タブは案内のみ表示 */
  team: TeamSchedule | null
  /**
   * UI の表示制御専用（保存ボタンを出すか・招待セクションを出すか）。
   * 実際の編集権限はサーバーの PATCH 側で必ず判定する（UI を隠すだけにしない二重防御）。
   */
  isAdmin: boolean
  /** 選択中チームのメンバーか（脱退ボタンの表示可否に使う。非メンバーには出さない） */
  isMember: boolean
  /** 新規チーム作成タブを使えるか（チーム作成権限）。無い場合は案内のみ表示 */
  canCreate: boolean
  onClose: () => void
  /** 保存成功時に親へ通知（親は再取得して最新化する） */
  onUpdated: () => void
  /** 新規チーム作成成功時に親へ通知（親が一覧再取得＆自チーム選択＆モーダルを閉じる） */
  onCreated: (team: TeamSummary) => void
  /** 招待リンク発行（親が createInvite → 招待モーダル表示まで担当） */
  onInvite: () => void
  /** 現在のタブ（URL クエリ `?setting=<tab>` 由来。親が単一の真実として持つ） */
  tab: SettingTab
  /** タブ切替（親が URL クエリを書き換える） */
  onTabChange: (tab: SettingTab) => void
  /** 脱退の確認モーダルを開く（親が overlay で確認モーダルを表示し、確定時に leaveTeam を叩く） */
  onLeave: () => void
  /** ログアウトの確認モーダルを開く（親が overlay で確認モーダルを表示し、確定時に logout を叩く） */
  onLogout: () => void
  /** アカウント削除の確認モーダルを開く（親が overlay で確認モーダルを表示する） */
  onDeleteAccount: () => void
}

const MODE_LABEL: Record<TeamManagementMode, string> = {
  members: "メンバー集計（各自が予定を入力）",
  team: "チーム単位（管理者がまとめて入力）",
}

const TABS: { key: SettingTab; label: string }[] = [
  { key: "team-management", label: "チーム管理" },
  { key: "team-creation", label: "新規作成" },
  { key: "global-settings", label: "全体設定" },
]

/** 準備中のセクション枠（未実装項目の見出しだけ先に置く） */
function ComingSoonSection({ title }: { title: string }) {
  return (
    <section className="border-t border-zinc-800 pt-4">
      <h3 className="text-sm font-bold text-zinc-300">{title}</h3>
      <p className="mt-1 text-xs text-zinc-500">準備中</p>
    </section>
  )
}

/**
 * 設定画面（#126 / #96 / #142）。
 * 未ログインでも開けて機能のイメージを掴めるが、その場合は全入力・ボタンを disabled にしてログインを促す。
 * ログイン後、編集できるのは admin 相当以上。
 * タブ構成: 今のチーム（設定変更・招待リンク発行）/ 新規チーム作成 / 全体設定（準備中）。
 * md 以下は body 全体を覆う実質ページ、lg 以上は中央カード。
 */
export function SettingModal({ isLoggedIn, onLogin, team, isAdmin, isMember, canCreate, onClose, onUpdated, onCreated, onInvite, onLeave, onLogout, onDeleteAccount, tab, onTabChange }: SettingModalProps) {
  // タブの選択状態は URL クエリ（?setting=<tab>）を単一の真実とし、親から tab/onTabChange で受け取る
  // 編集項目はモーダル末尾の「保存する」1つでまとめて保存する（変更のあった項目だけ1回の PATCH で送る）
  // team 未選択（null）でもフックは固定数呼ぶ必要があるため、初期値はフォールバックで持つ（チーム管理タブは team が無ければ案内のみ）
  const [name, setName] = useState(team?.name ?? "")
  const [mode, setMode] = useState<TeamManagementMode>(team?.managementMode ?? "members")
  // 活動可能人数は入力中は生の文字列で保持し（全消し・途中編集を許容）、blur 時に整数・最小値以上へ正規化する（ScheduleCell と同じ流儀）
  const [requiredCountText, setRequiredCountText] = useState(String(team?.requiredCount ?? DEFAULT_REQUIRED_COUNT))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 入力は trim 後で比較（前後空白だけの違いは変更とみなさない）。空文字は保存不可
  const trimmedName = name.trim()
  const nameDirty = trimmedName.length >= 1 && trimmedName !== team?.name
  const modeDirty = mode !== team?.managementMode
  // 活動可能人数は members モードでのみ意味を持つが、team モードでも保存は許可する（サーバーは常に最小値以上を検証、
  // team モードの成立判定は別途 1 固定。値を保持しておけば members に戻したときそのまま使える）
  // 入力文字列から整数・最小値以上へ正規化した値。dirty 判定・送信はこの正規化済みの値を使う
  const requiredCount = Math.max(MIN_REQUIRED_COUNT, Math.floor(Number(requiredCountText) || MIN_REQUIRED_COUNT))
  const requiredCountDirty = requiredCount !== team?.requiredCount
  const dirty = nameDirty || modeDirty || requiredCountDirty
  const canSubmit = !!team && isAdmin && dirty && !submitting

  const handleSubmit = async () => {
    if (!canSubmit || !team) return
    setSubmitting(true)
    setError(null)
    try {
      // 変更のあった項目だけ patch に積む（冪等：未変更フィールドは送らない）
      await updateTeam(team.teamId, {
        ...(nameDirty ? { name: trimmedName } : {}),
        ...(modeDirty ? { managementMode: mode } : {}),
        ...(requiredCountDirty ? { requiredCount } : {}),
      })
      onUpdated()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "チームの更新に失敗しました")
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto rounded-none border-0 bg-zinc-900 p-6 text-zinc-100 shadow-xl md:h-auto md:max-h-[90vh] md:w-[min(80vw,720px)] md:rounded-xl md:border md:border-zinc-700">
      <div className="flex items-start justify-between">
        <h2 className="text-base font-bold text-zinc-100">設定</h2>
        <button type="button" onClick={onClose} aria-label="閉じる" className="rounded-lg px-2 py-1 leading-none text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
          <CloseIcon className="h-5 w-5 fill-current" />
        </button>
      </div>

      {/* タブ切替 */}
      <div className="mt-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onTabChange(t.key)}
            className={
              "-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium " +
              (tab === t.key ? "border-indigo-500 text-zinc-100" : "border-transparent text-zinc-400 hover:text-zinc-200")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 未ログイン時の案内バナー。各タブの入力・ボタンは disabled のままイメージだけ見せ、ここからログインを促す */}
      {!isLoggedIn && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-indigo-700 bg-indigo-950/40 px-4 py-3">
          <p className="text-sm text-indigo-100">ログインすると、チームの作成・管理やスケジュール調整が使えるようになります！</p>
          <button type="button" onClick={onLogin} className="ml-auto shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
            ログイン
          </button>
        </div>
      )}

      {/* チーム管理: 設定変更・招待リンク発行・脱退（自チーム未選択なら案内のみ） */}
      {tab === "team-management" && !team && (
        <div className="mt-5">
          <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-6 text-center text-sm text-zinc-400">自チームを選択するとチームの設定が表示されます。</p>
        </div>
      )}
      {tab === "team-management" && team && (
        <div className="mt-5 flex flex-col gap-4">
          {/* チーム名（非 admin は disabled な input で値だけ見せ、編集はできない） */}
          <section>
            <h3 className="text-sm font-bold text-zinc-300">チーム名</h3>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting || !isAdmin}
              maxLength={50}
              placeholder="例: ○○サークル Aチーム"
              className="mt-2 w-full rounded border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-400 focus:outline-none disabled:opacity-50"
            />
          </section>

          {/* 活動可否の管理方法・活動可能人数（非 admin は disabled な select/input で値だけ見せ、編集はできない） */}
          <section className="border-t border-zinc-800 pt-4">
            <h3 className="text-sm font-bold text-zinc-300">活動可否の管理方法</h3>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as TeamManagementMode)}
              disabled={submitting || !isAdmin}
              className="mt-2 w-full rounded border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-indigo-400 focus:outline-none disabled:opacity-50"
            >
              <option value="members">{MODE_LABEL.members}</option>
              <option value="team">{MODE_LABEL.team}</option>
            </select>
            {/* 切替の副作用を事前に伝える（孤児化への不安・誤操作を減らす）。データ自体は消えない。編集できる admin のみ表示 */}
            {isAdmin && (
              <p className="mt-1.5 text-xs text-zinc-500">※ 管理方法を変えると、もう一方のモードで入力済みの予定は画面に表示されなくなります（データは保持され、戻せば再表示されます）。</p>
            )}
            {/* 活動可能人数は members モードでのみ使うため、team モードでは非表示にする（選択中の mode に即追従）。
                非表示中は requiredCountText に手を加えないので、既存値がそのまま保持・保存される。 */}
            {mode !== "team" && (
              <label className="mt-3 flex flex-col gap-1 text-sm">
                <span className="font-medium text-zinc-300">{REQUIRED_COUNT_LABEL}</span>
                <input
                  type="number"
                  min={MIN_REQUIRED_COUNT}
                  step={1}
                  value={requiredCountText}
                  onChange={(e) => setRequiredCountText(e.target.value)}
                  // 確定時に整数・最小値以上へ正規化（小数の排除・保存時の 400 予防はここで担保）
                  onBlur={() => setRequiredCountText(String(requiredCount))}
                  disabled={submitting || !isAdmin}
                  className="w-24 rounded border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-zinc-100 focus:border-indigo-400 focus:outline-none disabled:opacity-50"
                />
              </label>
            )}
          </section>

          {/* メンバー管理（準備中）。編集権限のない一般メンバーには出さない */}
          {isAdmin && <ComingSoonSection title="メンバー管理" />}

          {/* 招待リンク発行（admin のみ。発行・表示は親に委譲） */}
          {isAdmin && (
            <section className="border-t border-zinc-800 pt-4">
              <h3 className="text-sm font-bold text-zinc-300">招待リンク</h3>
              <p className="mt-1 text-xs text-zinc-500">リンクを渡すと、ログインした人がこのチームに参加できます。</p>
              <button type="button" onClick={onInvite} className="mt-2 rounded-lg border border-indigo-500 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-indigo-300 hover:bg-zinc-800">
                招待リンクを発行
              </button>
            </section>
          )}

          {/* 編集項目をまとめて保存する単一ボタン（admin のみ）。変更が無ければ disabled */}
          {isAdmin && (
            <section className="border-t border-zinc-800 pt-4">
              {error && <p className="mb-2 text-xs text-rose-400">{error}</p>}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "保存中…" : "保存する"}
                </button>
              </div>
            </section>
          )}

          {/* 脱退（このチームのメンバーのみ）。押すと確認モーダル（「脱退」と入力で確定。master は移譲を促す案内）を親が開く */}
          {isMember && (
            <section className="rounded-lg border-[1px] border-red-700 p-4">
              <h3 className="text-sm font-bold text-zinc-300">チームを脱退</h3>
              <p className="mt-1 text-xs text-zinc-500">このチームから抜けます。再参加には招待リンクが必要です。</p>
              <button
                type="button"
                onClick={onLeave}
                className="ml-auto mt-2 block w-fit rounded-lg border border-rose-700 bg-rose-950/40 px-3 py-1.5 text-sm font-medium text-rose-300 hover:bg-rose-900/40"
              >
                チームを脱退
              </button>
            </section>
          )}
        </div>
      )}

      {/* 新規チーム作成: 作成フォーム（作成ボタンはフォーム内） */}
      {tab === "team-creation" && (
        <div className="mt-5">
          {!isLoggedIn ? (
            // 未ログイン: フォームを disabled で見せ、何ができるかのイメージを持ってもらう（ログイン導線はバナー側）
            <CreateTeamForm onCreated={onCreated} disabled />
          ) : canCreate ? (
            <CreateTeamForm onCreated={onCreated} />
          ) : (
            // ログイン済みだが作成権限なし: プレリリース案内
            <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-400">{CREATE_TEAM_RESTRICTED_MESSAGE}</p>
          )}
        </div>
      )}

      {/* 全体設定 */}
      {tab === "global-settings" && (
        <div className="mt-5 flex flex-col gap-4">
          {/* ログアウト（アカウント削除の区切り線より上）。押すと確認モーダルを親が開く */}
          <section>
            <h3 className="text-sm font-bold text-zinc-300">ログアウト</h3>
            <p className="mt-1 text-xs text-zinc-500">このブラウザのログイン状態を解除します。</p>
            <button
              type="button"
              onClick={onLogout}
              disabled={!isLoggedIn}
              className="ml-auto mt-2 block w-fit rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ログアウト
            </button>
          </section>

          {/* アカウント削除。押すと確認モーダル（「削除」と入力で確定）を親が開く */}
          <section className="rounded-lg border-[1px] border-red-700 p-4">
            <h3 className="text-sm font-bold text-rose-300">アカウント削除</h3>
            <p className="mt-1 text-xs text-zinc-500">あなたのアカウントと、紐づく全データ（所属・予定など）を完全に削除します。取り消せません。</p>
            <button
              type="button"
              onClick={onDeleteAccount}
              disabled={!isLoggedIn}
              className="ml-auto mt-2 block w-fit rounded-lg border-[1px] border-red-700 bg-rose-950/40 px-3 py-1.5 text-sm font-medium text-rose-300 hover:bg-rose-900/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              アカウントを削除
            </button>
          </section>
        </div>
      )}
    </div>
  )
}
