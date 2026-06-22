/**
 * スクリム調整機能 - 活動可能通知（#172 即時 / #177 時刻指定）
 *
 * ある日が「活動可能」（members: ok 数 >= requiredCount / team: チーム状態が ok）に
 * なったら、チームに登録された Discord Webhook へ1回だけ通知する。送信タイミングは
 * teams.notifyActivityTime で切り替える:
 * - null:    即時通知。活動可能になった立ち上がりエッジでその場で送る（#172）。
 * - "HH:MM": 時刻指定通知。立ち上がりで QStash 単発ジョブをその日の HH:MM(JST) に予約し、
 *            発火時にもう一度活動可能か再判定してから送る（#177）。後から条件割れ/設定変更が
 *            起きても誤通知しないよう「発火時の再判定」を真実とする。
 *
 * 重複防止は schedule_notifications（マーカー行）で行う。kind は2種類:
 * - activity_reached:   送信済みマーカー（即時/時刻指定 共通。送信担当の latch）。
 * - activity_scheduled: QStash 登録済みマーカー（時刻指定のみ。二重 publish 防止の latch）。
 * 達成の立ち上がりで該当 latch を INSERT（勝者だけが進む）、谷に落ちたら両 kind を DELETE（再武装）。
 *
 * 記入 API のレスポンスを遅らせないため、呼び出し側は `after()` でレスポンス後に実行する。
 * 送信は fetchWithRetry（3秒タイムアウト・最大3回・バックオフ）を通し、失敗してもログのみ。
 */

import { and, eq, gte, inArray } from "drizzle-orm"
import { db } from "@/app/_server/lib/db"
import { schedules, scheduleNotifications, teamDayStatus, teams, teamWebhooks, users } from "@/app/_domains/teamSchedules/_server/schema"
import type { DayKey, TeamManagementMode, WebhookProvider } from "@/app/_domains/teamSchedules/types"
import { validateDiscordMessageContent } from "@/app/_domains/teamSchedules/discordMessage"
import { fetchWithRetry } from "@/app/_server/util/fetchWithRetry"
import { qstashPublishJSON } from "@/app/_server/lib/qstash/qstash"
import { APP_URL } from "@/app/_server/lib/env"

/** 送信済みマーカー（即時/時刻指定 共通）。schedule_notifications.kind と一致させる */
const KIND_REACHED = "activity_reached"
/** QStash 登録済みマーカー（時刻指定モードのみ・二重 publish 防止） */
const KIND_SCHEDULED = "activity_scheduled"

/** 発火コールバックのパス（QStash がこの URL を叩く） */
const NOTIFY_EXECUTE_PATH = "/api/web/team-schedules/notify/execute"

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"]

/**
 * "YYYY-MM-DD" を "M/D(曜)" に整形する。曜日は日付からローカルに計算する。
 * クライアントの _utils.ts（localStorage 依存）には依存させず、ここで純関数として持つ。
 */
export function formatDayLabel(day: DayKey): string {
  const [y, m, d] = day.split("-").map(Number)
  // 月/日のみ使うので TZ ずれは出ない（Date のローカル解釈で曜日だけ取る）
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()]
  return `${m}/${d}(${weekday})`
}

/**
 * DayKey("YYYY-MM-DD") + "HH:MM"(JST) を、その JST 壁時計時刻が指す UTC の瞬間に変換する（#177）。
 * JST = UTC+9 なので UTC では時が9つ手前。Date.UTC は hour に負値/桁あふれが来ても日付へ正規化するため、
 * "00:00" JST（= 前日 15:00 UTC）等も安全に算出できる。
 * 形式は呼び出し側で isHhmm / isDayKey 検証済みである前提（不正値の防御はしない）。
 */
export function combineDayAndTimeJst(day: DayKey, hhmm: string): Date {
  const [y, m, d] = day.split("-").map(Number)
  const [hh, mm] = hhmm.split(":").map(Number)
  return new Date(Date.UTC(y, m - 1, d, hh - 9, mm, 0, 0))
}

/** 現在時刻を JST カレンダー日付（YYYY-MM-DD）に落とす。バックフィルの下限（今日以降）に使う。 */
function todayJstDayKey(): DayKey {
  // UTC からの +9h で JST の壁時計に合わせ、日付部分だけ取り出す
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const y = jst.getUTCFullYear()
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0")
  const d = String(jst.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * Webhook URL を部分マスクする（admin に「登録済み」を示し、own/shared を見分けるための識別用）。
 * Discord Webhook は `{origin}/api/webhooks/{id}/{token}` と構造が固定なので、枠どうしで差が出る
 * {id} の先頭2文字までを見せ、秘密の {token} は伏せる。
 * 例: https://discord.com/api/webhooks/123/abcdef → https://discord.com/api/webhooks/12……
 * 注: webhook id は snowflake（時刻ベース）のため、近い時刻に作った2枠は先頭桁が一致しやすい。
 */
export function maskWebhookUrl(url: string): string {
  try {
    const u = new URL(url)
    const origin = `${u.protocol}//${u.host}`
    // 差が出る {id} の先頭2文字までを見せ、token は伏せる
    const m = u.pathname.match(/^\/api\/webhooks\/(\d+)\//)
    if (m) {
      return `${origin}/api/webhooks/${m[1].slice(0, 2)}……`
    }
    // 想定外の形（Discord 以外など）は安全側に倒し、origin だけ見せて以降を伏せる
    return `${origin}/……`
  } catch {
    // URL として壊れている場合は安全側に倒して全マスク
    return "……"
  }
}

/** Discord Webhook へテキストを送る（fetchWithRetry 経由・失敗時は throw） */
async function sendDiscordWebhook(webhookUrl: string, content: string): Promise<void> {
  await fetchWithRetry(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // allowed_mentions.parse=[] で @everyone/@here・ロール・ユーザーの全メンション解釈を抑止する。
    // 本文にはメンバー名や note（ユーザー入力）が入るため、"@everyone" 等が混ざってもピングさせない。
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
  })
}

/**
 * テスト通知を送る（/webhooks/test 用）。失敗時は throw（呼び出し側が成功/失敗を返す）。
 * UI で「保存前にテスト送信を成功させる」ためのエンドポイントから使う。
 */
export async function sendWebhookTest(provider: WebhookProvider, webhookUrl: string): Promise<void> {
  await sendByProvider(provider, webhookUrl, "✅ テスト通知です。このチャンネルに「活動可能になりました」の通知が届きます。")
}

/** provider に応じてテキストを送る（今は discord のみ） */
async function sendByProvider(provider: WebhookProvider, webhookUrl: string, content: string): Promise<void> {
  switch (provider) {
    case "discord":
      await sendDiscordWebhook(webhookUrl, content)
      return
    default:
      // 将来 provider が増えたらここに分岐を足す。未対応 provider は送らない（型上は到達しない）
      return
  }
}

/**
 * 活動可能通知メッセージを組み立てる。
 * 1行目: 🎉 【チーム名】M/D(曜) が活動可能になりました！ + members モードのみ「（○ N人）」
 *   （team モードはチーム単位の ok で個人の頭数ではないため、人数表記は付けない）
 * 2行目: ok のメンバー名（members モードのみ）。team モードは個人名が無いので note があれば note を出す。
 */
function buildContent(params: { teamName: string; day: DayKey; okCount: number; names: string[]; note: string | null }): string {
  const { teamName, day, okCount, names, note } = params
  // 人数表記は名前一覧（=members モード）があるときだけ付ける
  const countSuffix = names.length > 0 ? `（○ ${okCount}人）` : ""
  const line1 = `🎉 【${teamName}】${formatDayLabel(day)} が活動可能になりました！${countSuffix}`
  const line2 = names.length > 0 ? names.join(", ") : (note ?? "")
  return line2 ? `${line1}\n${line2}` : line1
}

/** その日が活動可能か + 表示用情報（メンバー名 / 件数 / note）を集計する */
type Aggregate = { reached: boolean; okCount: number; names: string[]; note: string | null }

async function aggregateDay(teamId: string, day: DayKey, managementMode: "members" | "team", requiredCount: number): Promise<Aggregate> {
  if (managementMode === "team") {
    const rows = await db
      .select({ status: teamDayStatus.status, note: teamDayStatus.note })
      .from(teamDayStatus)
      .where(and(eq(teamDayStatus.teamId, teamId), eq(teamDayStatus.day, day)))
      .limit(1)
    const row = rows[0]
    const reached = row?.status === "ok"
    return { reached, okCount: reached ? 1 : 0, names: [], note: row?.note ?? null }
  }

  // members モード: その日 ok のメンバーを名前順に取る（件数と2行目の名前を兼ねる）
  const okRows = await db
    .select({ displayName: users.displayName })
    .from(schedules)
    .innerJoin(users, eq(users.userId, schedules.userId))
    .where(and(eq(schedules.teamId, teamId), eq(schedules.day, day), eq(schedules.status, "ok")))
    .orderBy(users.displayName)
  const names = okRows.map((r) => r.displayName)
  return { reached: names.length >= requiredCount, okCount: names.length, names, note: null }
}

/** 通知に必要なチーム設定（名前・モード・必要人数・送信時刻）。存在しなければ null */
type TeamNotifyConfig = { name: string; managementMode: TeamManagementMode; requiredCount: number; notifyActivityTime: string | null }

async function loadTeamNotifyConfig(teamId: string): Promise<TeamNotifyConfig | null> {
  const rows = await db
    .select({ name: teams.name, managementMode: teams.managementMode, requiredCount: teams.requiredCount, notifyActivityTime: teams.notifyActivityTime })
    .from(teams)
    .where(eq(teams.teamId, teamId))
    .limit(1)
  return rows[0] ?? null
}

/** その日の全マーカー（送信済み/予約済み）を消して再武装する。1回の DELETE で両 kind を消す。 */
async function clearActivityMarkers(teamId: string, day: DayKey): Promise<void> {
  await db.delete(scheduleNotifications).where(and(eq(scheduleNotifications.teamId, teamId), eq(scheduleNotifications.day, day), inArray(scheduleNotifications.kind, [KIND_REACHED, KIND_SCHEDULED])))
}

/**
 * 活動可能達成済み前提で Webhook 送信する送信本体（即時/発火コールバック 共通）。
 * - 通知 ON の Webhook が無ければ何もしない（後から足したとき次の編集/発火で通知できるよう latch を作らない）。
 * - KIND_REACHED の latch を取れた勝者だけが送信する（同時実行・複数ジョブでも二重送信しない）。
 * 呼び出し側で agg.reached === true を保証すること。
 */
async function dispatchActivityNotification(teamId: string, day: DayKey, teamName: string, agg: Aggregate): Promise<void> {
  const hooks = await db
    .select({ provider: teamWebhooks.provider, webhookUrl: teamWebhooks.webhookUrl })
    .from(teamWebhooks)
    .where(and(eq(teamWebhooks.teamId, teamId), eq(teamWebhooks.notifyActivityReached, true)))
  if (hooks.length === 0) return

  const content = buildContent({ teamName, day, okCount: agg.okCount, names: agg.names, note: agg.note })

  // 文字数だけ送信前に検証する（2000字超は Discord が弾くので、無駄なリトライを避けてここで中止）。
  // メンションは allowed_mentions:{parse:[]} で無効化済みなので、メンバー名に @everyone 等が含まれても
  // 通知自体は止めない（everyone/here を許可扱いにしてメンション判定はスキップする）。
  // 中止時はマーカーを作らないので、本文が縮めば次の編集で再評価される。
  const validation = validateDiscordMessageContent(content, { everyone: true, here: true })
  if (!validation.ok) {
    console.error(`team-schedules notify: 本文が不正なため送信中止 (team=${teamId}, day=${day}): ${validation.reason}`)
    return
  }

  // 送信済みマーカーを INSERT。行が返った時だけ「今まさに初めてアームした=送信担当」とみなす。
  const inserted = await db
    .insert(scheduleNotifications)
    .values({ teamId, day, kind: KIND_REACHED })
    .onConflictDoNothing()
    .returning({ teamId: scheduleNotifications.teamId })
  if (inserted.length === 0) return // すでに通知済み

  // 各 Webhook へ送信。1つ失敗しても他は送る（送信失敗はログのみ・マーカーは残す＝再送しない）
  for (const h of hooks) {
    try {
      await sendByProvider(h.provider, h.webhookUrl, content)
    } catch (e) {
      console.error(`team-schedules notify: webhook 送信に失敗 (team=${teamId}, day=${day}):`, e)
    }
  }
}

/**
 * 時刻指定モードの予約処理（#177）。活動可能達成済み前提で、その日の HH:MM(JST) に QStash 単発ジョブを登録する。
 * - 通知 ON の Webhook が無ければ予約しない（即時モードと同じく、後から足したら次の編集で拾う）。
 * - 指定時刻を過ぎてから活動可能化した場合は登録しない（MVP: 過去への即時送信はしない）。
 * - KIND_SCHEDULED の latch を取れた勝者だけが publish（二重 publish 防止）。
 * - publish に失敗したら latch を残さず削除し、次の編集で再試行できるようにする。
 */
async function scheduleActivityNotification(teamId: string, day: DayKey, hhmm: string): Promise<void> {
  const enabled = await db
    .select({ slot: teamWebhooks.slot })
    .from(teamWebhooks)
    .where(and(eq(teamWebhooks.teamId, teamId), eq(teamWebhooks.notifyActivityReached, true)))
    .limit(1)
  if (enabled.length === 0) return

  const fireAt = combineDayAndTimeJst(day, hhmm)
  if (fireAt.getTime() <= Date.now()) {
    // 指定時刻を過ぎてから活動可能化（当日その時刻以降の記入など）。MVP では送らない（latch も作らない）
    return
  }

  const inserted = await db
    .insert(scheduleNotifications)
    .values({ teamId, day, kind: KIND_SCHEDULED })
    .onConflictDoNothing()
    .returning({ teamId: scheduleNotifications.teamId })
  if (inserted.length === 0) return // すでに予約済み

  try {
    await qstashPublishJSON(`${APP_URL}${NOTIFY_EXECUTE_PATH}`, { teamId, day }, Math.floor(fireAt.getTime() / 1000))
  } catch (e) {
    // publish 失敗 → latch を残さず削除（次の編集で再試行できるように）。ベストエフォートなのでログのみ
    await db.delete(scheduleNotifications).where(and(eq(scheduleNotifications.teamId, teamId), eq(scheduleNotifications.day, day), eq(scheduleNotifications.kind, KIND_SCHEDULED)))
    console.error(`team-schedules notify: QStash 予約に失敗 (team=${teamId}, day=${day}, at=${hhmm}):`, e)
  }
}

/**
 * 指定チーム・指定日について、活動可能の立ち上がりエッジで通知する/予約する。
 * 記入/削除のたびに呼ぶ（after() でレスポンス後に実行する想定）。
 * teams.notifyActivityTime が null なら即時送信、"HH:MM" なら時刻指定で予約に回す。
 * 内部で全て握り、失敗してもログのみ（呼び出し側のレスポンスには影響させない）。
 */
export async function maybeNotifyActivityReached(teamId: string, day: DayKey): Promise<void> {
  try {
    const team = await loadTeamNotifyConfig(teamId)
    if (!team) return

    const agg = await aggregateDay(teamId, day, team.managementMode, team.requiredCount)

    // 未達成: マーカーがあれば消して再武装し、何も送らない（どちらのモードでも共通）
    if (!agg.reached) {
      await clearActivityMarkers(teamId, day)
      return
    }

    if (team.notifyActivityTime) {
      // 時刻指定モード: 即時送信せず、その日の指定時刻へ単発ジョブを予約する
      await scheduleActivityNotification(teamId, day, team.notifyActivityTime)
    } else {
      // 即時モード（#172）: その場で送信する
      await dispatchActivityNotification(teamId, day, team.name, agg)
    }
  } catch (error) {
    console.error(`team-schedules notify: 通知処理でエラー (team=${teamId}, day=${day}):`, error)
  }
}

/**
 * 時刻指定ジョブの発火コールバックから呼ぶ送信本体（#177）。
 * 発火時にもう一度活動可能か再判定し、まだ達成なら送る（条件割れ・設定OFFはここで吸収して送らない）。
 * 内部で全て握り、失敗してもログのみ。
 */
export async function sendActivityReachedNow(teamId: string, day: DayKey): Promise<void> {
  try {
    const team = await loadTeamNotifyConfig(teamId)
    if (!team) return
    const agg = await aggregateDay(teamId, day, team.managementMode, team.requiredCount)
    if (!agg.reached) return // 発火時に条件割れ → 送らない（200 no-op）
    await dispatchActivityNotification(teamId, day, team.name, agg)
  } catch (error) {
    console.error(`team-schedules notify: 発火時の送信でエラー (team=${teamId}, day=${day}):`, error)
  }
}

/** 今日以降で活動可能な日を返す（バックフィル用）。members/team それぞれの集計で判定する。 */
async function findActiveFutureDays(teamId: string, managementMode: TeamManagementMode, requiredCount: number): Promise<DayKey[]> {
  const fromDay = todayJstDayKey()
  if (managementMode === "team") {
    const rows = await db
      .select({ day: teamDayStatus.day })
      .from(teamDayStatus)
      .where(and(eq(teamDayStatus.teamId, teamId), eq(teamDayStatus.status, "ok"), gte(teamDayStatus.day, fromDay)))
    return rows.map((r) => r.day)
  }
  // members モード: 日ごとに ok 数を数え、requiredCount 以上の日だけ返す
  const rows = await db
    .select({ day: schedules.day, status: schedules.status })
    .from(schedules)
    .where(and(eq(schedules.teamId, teamId), eq(schedules.status, "ok"), gte(schedules.day, fromDay)))
  const okCountByDay = new Map<DayKey, number>()
  for (const r of rows) okCountByDay.set(r.day, (okCountByDay.get(r.day) ?? 0) + 1)
  return [...okCountByDay.entries()].filter(([, n]) => n >= requiredCount).map(([day]) => day)
}

/**
 * 時刻指定の通知設定を新規セット/変更したときの遡及登録（#177）。
 * 設定前から既に活動可能だった「今日以降の日」を拾い、各日に予約を入れる
 * （次の編集を待たずに通知されるようにする）。after() でレスポンス後に実行する想定。
 * 内部で全て握り、失敗してもログのみ。
 */
export async function backfillActivityNotifications(teamId: string): Promise<void> {
  try {
    const team = await loadTeamNotifyConfig(teamId)
    if (!team || !team.notifyActivityTime) return // 即時モードへ戻した場合などは何もしない
    const days = await findActiveFutureDays(teamId, team.managementMode, team.requiredCount)
    for (const day of days) {
      // scheduleActivityNotification は latch・過去時刻・Webhook 有無を内部で吸収するので、そのまま各日に回す
      await scheduleActivityNotification(teamId, day, team.notifyActivityTime)
    }
  } catch (error) {
    console.error(`team-schedules notify: バックフィルでエラー (team=${teamId}):`, error)
  }
}
