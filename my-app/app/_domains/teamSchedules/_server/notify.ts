/**
 * スクリム調整機能 - 活動可能通知（#172）
 *
 * ある日が「活動可能」（members: ok 数 >= requiredCount / team: チーム状態が ok）に
 * なった立ち上がりエッジで、チームに登録された Discord Webhook へ1回だけ通知する。
 *
 * 重複送信防止は schedule_notifications（マーカー行）で行う:
 * - 達成 & マーカー無し → INSERT（レース勝者だけが送信）
 * - 未達成 & マーカー有り → DELETE（再武装。次に達成したらまた送る）
 *
 * 記入 API のレスポンスを遅らせないため、呼び出し側は `after()` でレスポンス後に実行する。
 * 送信は fetchWithRetry（3秒タイムアウト・最大3回・バックオフ）を通し、失敗してもログのみ。
 */

import { and, eq } from "drizzle-orm"
import { db } from "@/app/_server/lib/db"
import { schedules, scheduleNotifications, teamDayStatus, teams, teamWebhooks, users } from "@/app/_domains/teamSchedules/_server/schema"
import type { DayKey, WebhookProvider } from "@/app/_domains/teamSchedules/types"
import { fetchWithRetry } from "@/app/_server/util/fetchWithRetry"

/** 通知の種別。schedule_notifications.kind と一致させる（今はこの1種類のみ） */
const NOTIFICATION_KIND = "activity_reached"

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
 * Webhook URL を部分マスクする（admin に「登録済み」を示すための識別用）。
 * origin（スキーム+ホスト）+ パス先頭の1文字だけ残し、以降を伏せ字にする。秘密のトークン部分は出さない。
 * Discord の URL はパスが "/api/..." で始まるため、見える1文字は通常 "/"。
 * 例: https://discord.com/api/webhooks/123/abcdef → https://discord.com/……
 */
export function maskWebhookUrl(url: string): string {
  try {
    const u = new URL(url)
    const origin = `${u.protocol}//${u.host}`
    // origin の後ろ（パス先頭）から1文字だけ見せる
    const rest = url.slice(origin.length)
    const head = rest.length > 0 ? rest[0] : ""
    return `${origin}${head}……`
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
    body: JSON.stringify({ content }),
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

/**
 * 指定チーム・指定日について、活動可能の立ち上がりエッジなら Webhook 通知を送る。
 * 記入/削除のたびに呼ぶ（after() でレスポンス後に実行する想定）。
 * 内部で全て握り、失敗してもログのみ（呼び出し側のレスポンスには影響させない）。
 */
export async function maybeNotifyActivityReached(teamId: string, day: DayKey): Promise<void> {
  try {
    const teamRows = await db
      .select({ name: teams.name, managementMode: teams.managementMode, requiredCount: teams.requiredCount })
      .from(teams)
      .where(eq(teams.teamId, teamId))
      .limit(1)
    const team = teamRows[0]
    if (!team) return

    const agg = await aggregateDay(teamId, day, team.managementMode, team.requiredCount)

    // 未達成: マーカーがあれば消して再武装し、何も送らない
    if (!agg.reached) {
      await db.delete(scheduleNotifications).where(and(eq(scheduleNotifications.teamId, teamId), eq(scheduleNotifications.day, day), eq(scheduleNotifications.kind, NOTIFICATION_KIND)))
      return
    }

    // 達成: 送信対象（通知 ON の Webhook）が無ければマーカーを作らず終了
    // （後から Webhook を足したとき、次の編集で通知できるようにする）
    const hooks = await db
      .select({ provider: teamWebhooks.provider, webhookUrl: teamWebhooks.webhookUrl })
      .from(teamWebhooks)
      .where(and(eq(teamWebhooks.teamId, teamId), eq(teamWebhooks.notifyActivityReached, true)))
    if (hooks.length === 0) return

    // マーカーを INSERT。行が返った時だけ「今まさに初めてアームした=送信担当」とみなす。
    // 同時書き込みで複数の after が走っても、勝者1人だけが送る（二重送信防止）。
    const inserted = await db
      .insert(scheduleNotifications)
      .values({ teamId, day, kind: NOTIFICATION_KIND })
      .onConflictDoNothing()
      .returning({ teamId: scheduleNotifications.teamId })
    if (inserted.length === 0) return // すでに通知済み

    const content = buildContent({ teamName: team.name, day, okCount: agg.okCount, names: agg.names, note: agg.note })

    // 各 Webhook へ送信。1つ失敗しても他は送る（送信失敗はログのみ・マーカーは残す＝再送しない）
    for (const h of hooks) {
      try {
        await sendByProvider(h.provider, h.webhookUrl, content)
      } catch (e) {
        console.error(`team-schedules notify: webhook 送信に失敗 (team=${teamId}, day=${day}):`, e)
      }
    }
  } catch (error) {
    console.error(`team-schedules notify: 通知処理でエラー (team=${teamId}, day=${day}):`, error)
  }
}
