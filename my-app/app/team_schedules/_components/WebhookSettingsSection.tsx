"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchTeamWebhooks, sendWebhookTest, updateTeamWebhooks } from "@/app/_domains/teamSchedules/_client/teamSchedulesApiClient"
import { WEBHOOK_SLOTS, WEBHOOK_SLOT_LABEL, type TeamWebhookSlotPatch, type TeamWebhooksUpdate, type WebhookSlot } from "@/app/_domains/teamSchedules/types"

/** 時刻指定モードへ切り替えたときのデフォルト送信時刻（JST） */
const DEFAULT_NOTIFY_TIME = "20:00"

/**
 * 活動可能の通知（Discord Webhook）設定セクション（#172・admin 相当以上）。
 *
 * 権限による出し分け:
 * - master: 既存 URL を input に prefill して見せる。
 * - admin（非 master）: URL は読めない。登録済みなら部分マスク（maskedUrl）を表示し、新 URL で上書きする運用。
 *
 * テスト強制（UI のみ）: URL を新規入力/変更した枠は、テスト送信が成功するまで保存できない。
 * サーバーはテスト実施を検証しないため、これはあくまで UI 上のガード。
 *
 * 本体モーダルの「保存する」とは独立した保存ボタンを持つ（テスト強制で名前変更等までブロックしないため）。
 */

/** Discord 受信 Webhook URL らしいか（テスト/保存ボタンの活性化に使う簡易チェック。厳密判定はサーバー側） */
function looksLikeDiscordWebhook(url: string): boolean {
  return /^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\//.test(url.trim())
}

/** 1枠ぶんの編集状態 */
type SlotState = {
  /** URL 入力欄の値（master は初期値=現 URL / admin は空） */
  url: string
  /** 通知トグル */
  notify: boolean
  /** 既に登録済みか */
  configured: boolean
  /** admin 向けの部分マスク表示（master や未設定では null） */
  maskedUrl: string | null
  /** ロード時の通知トグル初期値（dirty 判定用） */
  initialNotify: boolean
  /** ロード時の URL 初期値（master のみ意味を持つ。admin は常に ""） */
  initialUrl: string
  /** 直近でテスト送信に成功した URL（保存ゲート用） */
  testedUrl: string | null
}

const emptySlot = (): SlotState => ({ url: "", notify: true, configured: false, maskedUrl: null, initialNotify: true, initialUrl: "", testedUrl: null })

type SlotsState = Record<WebhookSlot, SlotState>

const initialSlots = (): SlotsState => ({ own: emptySlot(), shared: emptySlot() })

export function WebhookSettingsSection({ teamId, isMaster }: { teamId: string; isMaster: boolean }) {
  const [slots, setSlots] = useState<SlotsState>(initialSlots)
  // 送信タイミング（#177）。モード（即時/指定時刻）と時刻値を分離して持つ。
  // 1つの文字列に両方載せると、時刻欄を空にした瞬間に即時モードへ落ちて設定が消える事故になるため。
  const [scheduled, setScheduled] = useState(false) // true = 指定時刻モード
  const [timeValue, setTimeValue] = useState(DEFAULT_NOTIFY_TIME) // "HH:MM"
  const [initialNotifyTime, setInitialNotifyTime] = useState<string | null>(null) // サーバー値（dirty判定用。null=即時）
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  // 枠ごとのテスト状態（送信中 / エラー）
  const [testing, setTesting] = useState<Record<WebhookSlot, boolean>>({ own: false, shared: false })
  const [testError, setTestError] = useState<Record<WebhookSlot, string | null>>({ own: null, shared: null })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const { webhooks, notifyTime: loadedTime } = await fetchTeamWebhooks(teamId)
      setScheduled(loadedTime !== null)
      setTimeValue(loadedTime ?? DEFAULT_NOTIFY_TIME)
      setInitialNotifyTime(loadedTime)
      const next = initialSlots()
      for (const w of webhooks) {
        // master は生 URL を初期表示、admin は空のまま（maskedUrl だけ見せる）
        const url = isMaster ? (w.webhookUrl ?? "") : ""
        next[w.slot] = {
          url,
          notify: w.notifyActivityReached,
          configured: w.configured,
          maskedUrl: w.maskedUrl ?? null,
          initialNotify: w.notifyActivityReached,
          initialUrl: url,
          testedUrl: null,
        }
      }
      setSlots(next)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "通知設定の取得に失敗しました")
    } finally {
      setLoading(false)
    }
  }, [teamId, isMaster])

  useEffect(() => {
    void load()
  }, [load])

  const updateSlot = (slot: WebhookSlot, patch: Partial<SlotState>) => {
    setSlots((prev) => ({ ...prev, [slot]: { ...prev[slot], ...patch } }))
    setSaved(false)
  }

  const updateScheduled = (next: boolean) => {
    setScheduled(next)
    setSaved(false)
  }

  const updateTimeValue = (next: string) => {
    setTimeValue(next)
    setSaved(false)
  }

  // URL を新規/変更したか（admin は initialUrl="" なので入力すれば常に変更扱い）
  const isUrlChanged = (s: SlotState) => s.url.trim().length > 0 && s.url.trim() !== s.initialUrl
  // この枠が保存ゲートに引っかかるか（URL を変えたのにそのURLでテスト成功していない）
  const isUrlUntested = (s: SlotState) => isUrlChanged(s) && s.testedUrl !== s.url.trim()

  const handleTest = async (slot: WebhookSlot) => {
    const url = slots[slot].url.trim()
    if (!looksLikeDiscordWebhook(url)) return
    setTesting((p) => ({ ...p, [slot]: true }))
    setTestError((p) => ({ ...p, [slot]: null }))
    try {
      await sendWebhookTest(teamId, { webhookUrl: url })
      updateSlot(slot, { testedUrl: url })
    } catch (e) {
      setTestError((p) => ({ ...p, [slot]: e instanceof Error ? e.message : "テスト送信に失敗しました" }))
    } finally {
      setTesting((p) => ({ ...p, [slot]: false }))
    }
  }

  const handleDelete = async (slot: WebhookSlot) => {
    setSaving(true)
    setSaveError(null)
    try {
      await updateTeamWebhooks(teamId, { [slot]: null })
      await load()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "削除に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  // 各枠の patch を組み立てる（変更が無ければ undefined）
  const buildPatch = (slot: WebhookSlot): TeamWebhookSlotPatch | undefined => {
    const s = slots[slot]
    if (isUrlChanged(s)) {
      return { webhookUrl: s.url.trim(), notifyActivityReached: s.notify }
    }
    // URL 変更なし・トグルだけ変わった（登録済みの枠のみ意味を持つ）
    if (s.configured && s.notify !== s.initialNotify) {
      return { notifyActivityReached: s.notify }
    }
    return undefined
  }

  const ownPatch = buildPatch("own")
  const sharedPatch = buildPatch("shared")
  // 指定時刻モードでの実効値。即時モードなら null
  const effectiveNotifyTime = scheduled ? timeValue : null
  const notifyTimeDirty = effectiveNotifyTime !== initialNotifyTime
  // 指定時刻モードなのに時刻が空/不正なら保存させない（空クリアで即時へ落とさない）
  const notifyTimeInvalid = scheduled && !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue)
  const dirty = ownPatch !== undefined || sharedPatch !== undefined || notifyTimeDirty
  // 変更した URL がテスト未了なら保存不可
  const blockedByUntested = WEBHOOK_SLOTS.some((slot) => isUrlUntested(slots[slot]))
  const canSave = dirty && !blockedByUntested && !notifyTimeInvalid && !saving

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setSaveError(null)
    try {
      const patch: TeamWebhooksUpdate = {}
      if (ownPatch) patch.own = ownPatch
      if (sharedPatch) patch.shared = sharedPatch
      // 即時=null / 指定="HH:MM"。未変更なら送らない（キーを付けない）
      if (notifyTimeDirty) patch.notifyTime = effectiveNotifyTime
      await updateTeamWebhooks(teamId, patch)
      await load()
      setSaved(true)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "通知設定の保存に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="border-t border-zinc-800 pt-4">
      <h3 className="text-sm font-bold text-zinc-300">活動可能の通知（Discord）</h3>
      <p className="mt-1 text-xs text-zinc-500">
        登録したサーバーへ「活動可能になった日」を自動で通知します。Discord のサーバー設定 → 連携サービス → ウェブフック で発行した URL を貼り付けてください。
      </p>

      {loading ? (
        <p className="mt-3 text-xs text-zinc-500">読み込み中…</p>
      ) : loadError ? (
        <p className="mt-3 text-xs text-rose-400">{loadError}</p>
      ) : (
        <div className="mt-3 flex flex-col gap-5">
          {/* 送信タイミング（#177）。即時 or 指定時刻 */}
          <div className="rounded-lg border border-zinc-800 p-3">
            <span className="text-sm font-medium text-zinc-200">通知タイミング</span>
            <div className="mt-2 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="radio" name="notify-timing" checked={!scheduled} onChange={() => updateScheduled(false)} disabled={saving} className="h-4 w-4 accent-indigo-500" />
                活動可能になり次第すぐに通知
              </label>
              <label className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">
                <input type="radio" name="notify-timing" checked={scheduled} onChange={() => updateScheduled(true)} disabled={saving} className="h-4 w-4 accent-indigo-500" />
                指定した時刻に通知
                <input
                  type="time"
                  value={timeValue}
                  onChange={(e) => updateTimeValue(e.target.value)}
                  disabled={saving || !scheduled}
                  className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 focus:border-indigo-400 focus:outline-none disabled:opacity-50"
                />
                <span className="text-xs text-zinc-500">（その日の時刻・日本時間）</span>
              </label>
              {notifyTimeInvalid && <p className="text-xs text-rose-400">時刻を入力してください（即時に戻すには上を選択）。</p>}
            </div>
          </div>

          {WEBHOOK_SLOTS.map((slot) => {
            const s = slots[slot]
            const valid = looksLikeDiscordWebhook(s.url)
            const untested = isUrlUntested(s)
            return (
              <div key={slot} className="rounded-lg border border-zinc-800 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-200">{WEBHOOK_SLOT_LABEL[slot]}</span>
                  {s.configured && (
                    <button type="button" onClick={() => handleDelete(slot)} disabled={saving} className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-50">
                      削除
                    </button>
                  )}
                </div>

                {/* admin（非 master）向け: 登録済み URL を部分マスクで識別表示 */}
                {!isMaster && s.configured && s.maskedUrl && <p className="mt-1 text-xs text-zinc-500">登録済み: {s.maskedUrl}</p>}

                <input
                  type="text"
                  value={s.url}
                  onChange={(e) => updateSlot(slot, { url: e.target.value, testedUrl: null })}
                  disabled={saving}
                  placeholder={!isMaster && s.configured ? "新しい URL で上書きする場合のみ入力" : "https://discord.com/api/webhooks/..."}
                  className="mt-2 w-full rounded border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-400 focus:outline-none disabled:opacity-50"
                />

                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleTest(slot)}
                    disabled={!valid || testing[slot] || saving}
                    className="rounded-lg border border-indigo-500 bg-zinc-900 px-3 py-1 text-xs font-medium text-indigo-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {testing[slot] ? "送信中…" : "テスト送信"}
                  </button>
                  {s.testedUrl && s.testedUrl === s.url.trim() && <span className="text-xs text-emerald-400">テスト送信に成功しました</span>}
                  {untested && !testing[slot] && <span className="text-xs text-amber-400">保存前にテスト送信してください</span>}
                  {testError[slot] && <span className="text-xs text-rose-400">{testError[slot]}</span>}
                </div>

                <label className="mt-2 flex items-center gap-2 text-sm text-zinc-300">
                  <input type="checkbox" checked={s.notify} onChange={(e) => updateSlot(slot, { notify: e.target.checked })} disabled={saving} className="h-4 w-4 accent-indigo-500" />
                  活動可能になったら通知する
                </label>
              </div>
            )
          })}

          {saveError && <p className="text-xs text-rose-400">{saveError}</p>}
          <div className="flex items-center justify-end gap-3">
            {saved && <span className="text-xs text-emerald-400">保存しました</span>}
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "保存中…" : "通知設定を保存"}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
