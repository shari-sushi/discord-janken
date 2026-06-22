import { describe, it, expect, vi, beforeEach } from "vitest"
import { teams, schedules, teamDayStatus, teamWebhooks } from "./schema"

// fetchWithRetry をモックして「何回・どんな本文で送ったか」を観測する
const mockFetchWithRetry = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 }))
vi.mock("@/app/_server/util/fetchWithRetry", () => ({
  fetchWithRetry: (url: string, init?: RequestInit) => mockFetchWithRetry(url, init),
}))

// DB はテーブルごとに結果を差し替えられるようにモックする。
// select(...).from(table) は table の identity で結果を出し分ける。
// 各チェーンメソッドは「チェーン可能 かつ thenable」なオブジェクトを返し、await でその結果に解決する。
type Row = Record<string, unknown>
const results = new Map<unknown, Row[]>()
let insertedMarker: Row[] = [] // insert ... returning が返す行（[]=既に通知済み）
const insertValues = vi.fn((..._args: unknown[]) => undefined)
const deleteWhere = vi.fn(async () => undefined)
const del = vi.fn((..._args: unknown[]) => ({ where: deleteWhere }))

function makeQuery(result: Row[]) {
  const q: Record<string, unknown> = {
    where: () => q,
    innerJoin: () => q,
    orderBy: () => Promise.resolve(result),
    limit: () => Promise.resolve(result),
    then: (resolve: (v: Row[]) => unknown) => resolve(result),
  }
  return q
}

vi.mock("@/app/_server/lib/db", () => ({
  db: {
    select: () => ({ from: (table: unknown) => makeQuery(results.get(table) ?? []) }),
    insert: () => ({
      values: (...args: unknown[]) => {
        insertValues(...args)
        return { onConflictDoNothing: () => ({ returning: () => Promise.resolve(insertedMarker) }) }
      },
    }),
    delete: (...args: unknown[]) => del(...args),
  },
}))

import { maybeNotifyActivityReached, maskWebhookUrl, formatDayLabel } from "./notify"

const TEAM_ID = "123e4567-e89b-42d3-a456-426614174000"
const DAY = "2026-06-24"
const HOOK = { provider: "discord", webhookUrl: "https://discord.com/api/webhooks/1/abc" }

beforeEach(() => {
  vi.clearAllMocks()
  results.clear()
  insertedMarker = [{ teamId: TEAM_ID }] // 既定: マーカー新規挿入に成功（=送信担当）
  mockFetchWithRetry.mockResolvedValue(new Response(null, { status: 204 }))
})

/** members モードのチームを設定（requiredCount 指定） */
function setupMembersTeam(requiredCount: number, okNames: string[]) {
  results.set(teams, [{ name: "テストチーム", managementMode: "members", requiredCount }])
  results.set(schedules, okNames.map((displayName) => ({ displayName })))
  results.set(teamWebhooks, [HOOK])
}

describe("maskWebhookUrl", () => {
  it("success: webhook id の先頭2文字まで見せ、token は伏せる", () => {
    // 枠どうしで差が出る {id} の先頭2文字までを見せ、秘密の {token} は出さない
    expect(maskWebhookUrl("https://discord.com/api/webhooks/123456/secrettoken")).toBe("https://discord.com/api/webhooks/12……")
  })
  it("success: discordapp.com / サブドメインでも id 先頭2文字まで見せる", () => {
    expect(maskWebhookUrl("https://canary.discordapp.com/api/webhooks/987654/tok")).toBe("https://canary.discordapp.com/api/webhooks/98……")
  })
  it("failure: webhooks 形式でない URL は origin だけ見せて以降を伏せる", () => {
    expect(maskWebhookUrl("https://example.com/foo/bar")).toBe("https://example.com/……")
  })
  it("failure: URL として壊れていれば全マスク", () => {
    expect(maskWebhookUrl("not-a-url")).toBe("……")
  })
})

describe("formatDayLabel", () => {
  it("success: M/D(曜) に整形する", () => {
    // 2026-06-24 は水曜
    expect(formatDayLabel("2026-06-24")).toBe("6/24(水)")
  })
})

describe("maybeNotifyActivityReached (members モード)", () => {
  it("success: 閾値に到達した立ち上がりエッジで Webhook 送信し、マーカーを INSERT する", async () => {
    setupMembersTeam(3, ["あ", "い", "う"])
    await maybeNotifyActivityReached(TEAM_ID, DAY)
    expect(insertValues).toHaveBeenCalledTimes(1)
    expect(mockFetchWithRetry).toHaveBeenCalledTimes(1)
    const body = JSON.parse((mockFetchWithRetry.mock.calls[0][1] as RequestInit).body as string)
    expect(body.content).toContain("活動可能になりました")
    expect(body.content).toContain("あ, い, う") // 2行目にメンバー名
    // メンション解釈は全抑止（@everyone 等が本文に混ざってもピングさせない）
    expect(body.allowed_mentions).toEqual({ parse: [] })
  })

  it("success: 既に通知済み（マーカー INSERT が空）なら送信しない", async () => {
    setupMembersTeam(3, ["あ", "い", "う"])
    insertedMarker = [] // onConflictDoNothing で何も返らない=既に通知済み
    await maybeNotifyActivityReached(TEAM_ID, DAY)
    expect(mockFetchWithRetry).not.toHaveBeenCalled()
  })

  it("success: 閾値未満なら送信せず、マーカーを DELETE（再武装）する", async () => {
    setupMembersTeam(3, ["あ", "い"]) // 2 < 3
    await maybeNotifyActivityReached(TEAM_ID, DAY)
    expect(mockFetchWithRetry).not.toHaveBeenCalled()
    expect(insertValues).not.toHaveBeenCalled()
    expect(del).toHaveBeenCalledTimes(1)
    expect(deleteWhere).toHaveBeenCalledTimes(1)
  })

  it("success: 通知 ON の Webhook が無ければ送信せずマーカーも作らない", async () => {
    results.set(teams, [{ name: "テストチーム", managementMode: "members", requiredCount: 1 }])
    results.set(schedules, [{ displayName: "あ" }])
    results.set(teamWebhooks, []) // 送信先なし
    await maybeNotifyActivityReached(TEAM_ID, DAY)
    expect(mockFetchWithRetry).not.toHaveBeenCalled()
    expect(insertValues).not.toHaveBeenCalled()
  })

  it("failure: 1つの Webhook 送信が失敗しても処理は throw しない（ログのみ）", async () => {
    setupMembersTeam(1, ["あ"])
    mockFetchWithRetry.mockRejectedValue(new Error("HTTP 500"))
    await expect(maybeNotifyActivityReached(TEAM_ID, DAY)).resolves.toBeUndefined()
  })
})

describe("maybeNotifyActivityReached (team モード)", () => {
  it("success: チーム状態が ok の立ち上がりで送信する", async () => {
    results.set(teams, [{ name: "相手チーム", managementMode: "team", requiredCount: 1 }])
    results.set(teamDayStatus, [{ status: "ok", note: "21時集合" }])
    results.set(teamWebhooks, [HOOK])
    await maybeNotifyActivityReached(TEAM_ID, DAY)
    expect(mockFetchWithRetry).toHaveBeenCalledTimes(1)
    const body = JSON.parse((mockFetchWithRetry.mock.calls[0][1] as RequestInit).body as string)
    expect(body.content).toContain("21時集合") // 個人名が無いので note を2行目に出す
  })

  it("success: チーム状態が ok でなければ送信せず DELETE（再武装）", async () => {
    results.set(teams, [{ name: "相手チーム", managementMode: "team", requiredCount: 1 }])
    results.set(teamDayStatus, [{ status: "ng", note: null }])
    results.set(teamWebhooks, [HOOK])
    await maybeNotifyActivityReached(TEAM_ID, DAY)
    expect(mockFetchWithRetry).not.toHaveBeenCalled()
    expect(del).toHaveBeenCalledTimes(1)
  })
})
