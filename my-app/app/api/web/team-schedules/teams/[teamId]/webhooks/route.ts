import { and, eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_server/lib/db"
import { teamWebhooks } from "@/app/_domains/teamSchedules/_server/schema"
import { getSessionUserId, getTeamRole } from "@/app/_domains/teamSchedules/_server/authz"
import { hasAdminAuthority, WEBHOOK_SLOTS, type TeamRole, type TeamWebhookSlotPatch, type TeamWebhookView, type WebhookProvider, type WebhookSlot } from "@/app/_domains/teamSchedules/types"
import { isDiscordWebhookUrl, isUuid, isWebhookProvider } from "@/app/_domains/teamSchedules/_server/validators"
import { maskWebhookUrl } from "@/app/_domains/teamSchedules/_server/notify"

type RouteContext = { params: Promise<{ teamId: string }> }

/** 認可に失敗したら返すべきレスポンス、成功なら role を返す */
type AuthzResult = { ok: true; role: TeamRole } | { ok: false; res: NextResponse }

/**
 * Webhook を操作できるかを「認証 → メンバーシップ → admin 相当」の順に判定する。
 * URL は機密なので非 admin には存在を隠す（PATCH/team-status と同じ流儀）:
 * - 非UUID / 非メンバー: 404
 * - メンバーだが admin 相当未満（member）: 404（閲覧も変更もさせない＝存在隠匿）
 * 返す role で master / admin を呼び出し側が出し分ける（GET の URL 開示など）。
 */
async function authorizeWebhookAccess(req: NextRequest, teamId: string): Promise<AuthzResult> {
  if (!isUuid(teamId)) {
    return { ok: false, res: NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 }) }
  }
  const userId = await getSessionUserId(req)
  if (!userId) {
    return { ok: false, res: NextResponse.json({ success: false, error: "ログインが必要です" }, { status: 401 }) }
  }
  const role = await getTeamRole(teamId, userId)
  if (role === null || !hasAdminAuthority(role)) {
    // 非メンバー / member は存在を隠して 404
    return { ok: false, res: NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 }) }
  }
  return { ok: true, role }
}

/**
 * GET /api/web/team-schedules/teams/[teamId]/webhooks
 * 設定済みの Webhook 枠を返す（admin 相当以上）。閲覧権限で中身が変わる:
 * - master: 生 webhookUrl を含める（URL を読めるのは master のみ）
 * - admin（非 master）: webhookUrl は null、maskedUrl に部分マスクだけ入れる
 */
export async function GET(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    const { teamId } = await ctx.params
    const authz = await authorizeWebhookAccess(req, teamId)
    if (!authz.ok) return authz.res
    const isMaster = authz.role === "master"

    const rows = await db
      .select({ slot: teamWebhooks.slot, provider: teamWebhooks.provider, webhookUrl: teamWebhooks.webhookUrl, notifyActivityReached: teamWebhooks.notifyActivityReached })
      .from(teamWebhooks)
      .where(eq(teamWebhooks.teamId, teamId))

    const webhooks: TeamWebhookView[] = rows.map((r) => ({
      slot: r.slot,
      provider: r.provider,
      notifyActivityReached: r.notifyActivityReached,
      configured: true,
      // URL を読めるのは master のみ。admin には生 URL を渡さず部分マスクだけ返す
      webhookUrl: isMaster ? r.webhookUrl : null,
      maskedUrl: isMaster ? null : maskWebhookUrl(r.webhookUrl),
    }))

    return NextResponse.json({ success: true, webhooks })
  } catch (error) {
    console.error("team-schedules webhooks GET error:", error)
    return NextResponse.json({ success: false, error: "通知設定の取得に失敗しました" }, { status: 500 })
  }
}

/** 1枠ぶんの入力が妥当か（null=削除 / undefined=未指定 はそのまま通す）。validators の isValid* 群に合わせ boolean を返す。 */
function isValidSlotPatch(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value !== "object") return false
  const v = value as TeamWebhookSlotPatch
  if (v.provider !== undefined && !isWebhookProvider(v.provider)) return false
  if (v.webhookUrl !== undefined && !isDiscordWebhookUrl(v.webhookUrl)) return false
  if (v.notifyActivityReached !== undefined && typeof v.notifyActivityReached !== "boolean") return false
  // 中身が空（何も変えない）のオブジェクトは無効扱い（誤用を弾く）
  if (v.provider === undefined && v.webhookUrl === undefined && v.notifyActivityReached === undefined) return false
  return true
}

/** 1枠ぶんを適用する。戻り値 false は「トグルのみ更新だが対象行が無い」= 400 にすべきケース。 */
async function applySlotPatch(teamId: string, slot: WebhookSlot, value: TeamWebhookSlotPatch | null): Promise<boolean> {
  // null = その枠を削除（未設定に戻す）
  if (value === null) {
    await db.delete(teamWebhooks).where(and(eq(teamWebhooks.teamId, teamId), eq(teamWebhooks.slot, slot)))
    return true
  }

  const provider: WebhookProvider = value.provider ?? "discord"

  // URL あり → upsert（URL を新規/上書き）。notify は来ていれば反映、無ければ既定/現状維持
  if (value.webhookUrl !== undefined) {
    await db
      .insert(teamWebhooks)
      .values({ teamId, slot, provider, webhookUrl: value.webhookUrl, notifyActivityReached: value.notifyActivityReached ?? true })
      .onConflictDoUpdate({
        target: [teamWebhooks.teamId, teamWebhooks.slot],
        set: {
          provider,
          webhookUrl: value.webhookUrl,
          updatedAt: new Date(),
          ...(value.notifyActivityReached !== undefined ? { notifyActivityReached: value.notifyActivityReached } : {}),
        },
      })
    return true
  }

  // URL 無し・トグルのみ → 既存行のトグルだけ更新（admin は URL を読めなくてもトグルは変えられる）
  if (value.notifyActivityReached !== undefined) {
    const updated = await db
      .update(teamWebhooks)
      .set({ notifyActivityReached: value.notifyActivityReached, updatedAt: new Date() })
      .where(and(eq(teamWebhooks.teamId, teamId), eq(teamWebhooks.slot, slot)))
      .returning({ slot: teamWebhooks.slot })
    // 対象行が無いのにトグルだけ来た = 不正（先に URL 登録が必要）
    return updated.length > 0
  }

  return true
}

/**
 * PUT /api/web/team-schedules/teams/[teamId]/webhooks
 * Webhook 枠を per-slot で更新する（admin 相当以上）。body: { own?, shared? }
 * 各枠: オブジェクト（webhookUrl で上書き / notify のみでトグル更新）/ null（削除）/ 未指定（触らない）。
 */
export async function PUT(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    const { teamId } = await ctx.params
    const authz = await authorizeWebhookAccess(req, teamId)
    if (!authz.ok) return authz.res

    const body = (await req.json().catch(() => null)) as Partial<Record<WebhookSlot, TeamWebhookSlotPatch | null>> | null
    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "入力が不正です" }, { status: 400 })
    }

    // 先に全枠を検証してから適用する（不正値があれば部分書き込みせず 400 で弾く）
    for (const slot of WEBHOOK_SLOTS) {
      if (!isValidSlotPatch(body[slot])) {
        return NextResponse.json({ success: false, error: "入力が不正です" }, { status: 400 })
      }
    }

    for (const slot of WEBHOOK_SLOTS) {
      const value = body[slot]
      if (value === undefined) continue // 未指定の枠は触らない
      const applied = await applySlotPatch(teamId, slot, value)
      if (!applied) {
        return NextResponse.json({ success: false, error: "対象の Webhook が未登録です（先に URL を登録してください）" }, { status: 400 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("team-schedules webhooks PUT error:", error)
    return NextResponse.json({ success: false, error: "通知設定の保存に失敗しました" }, { status: 500 })
  }
}
