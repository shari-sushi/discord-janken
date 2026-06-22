import { describe, it, expect, beforeEach, vi } from "vitest"

// db をテーブル identity で出し分ける。
// - getUserTeamIds: select().from(teamMembers).where() → memberRows
// - getSharePartners / getSharePartnersForTeams: select().from(teamShares).where() → shareRows
const h = vi.hoisted(() => ({
  shareRows: [] as { teamLow: string; teamHigh: string }[],
  memberRows: [] as { teamId: string }[],
}))
vi.mock("@/app/_server/lib/db", async () => {
  const schema = await import("./schema")
  return {
    db: {
      select: () => ({
        from: (table: unknown) => ({
          where: () => Promise.resolve(table === schema.teamShares ? h.shareRows : h.memberRows),
        }),
      }),
    },
  }
})

import { orderPair, getSharePartners, getSharePartnersForTeams, isTeamVisible, isTeamVisibleTo } from "./shares"

describe("teamSchedules shares helpers", () => {
  beforeEach(() => {
    h.shareRows = []
    h.memberRows = []
  })

  describe("orderPair", () => {
    it("success: 常に teamLow < teamHigh に正規化する（引数の順序によらず同じ）", () => {
      expect(orderPair("a", "b")).toEqual({ teamLow: "a", teamHigh: "b" })
      expect(orderPair("b", "a")).toEqual({ teamLow: "a", teamHigh: "b" })
    })

    it("success: UUID のような文字列でも辞書順で正規化する", () => {
      const x = "11111111-1111-1111-1111-111111111111"
      const y = "22222222-2222-2222-2222-222222222222"
      expect(orderPair(y, x)).toEqual({ teamLow: x, teamHigh: y })
    })

    it("success: 大小混在の入力は小文字へ正規化してから順序づけする（Postgres uuid 比較との整合・CHECK違反500の防止）", () => {
      // JS の ASCII 比較では "B..."(0x42) < "a..."(0x61) だが、小文字化すると "b" > "a"。
      // 正規化しないと team_low に大文字 B が来て DB の team_low<team_high を破る。
      const upperB = "BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB"
      const lowerA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
      expect(orderPair(upperB, lowerA)).toEqual({
        teamLow: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        teamHigh: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      })
    })
  })

  describe("getSharePartners", () => {
    it("success: team_low 側のときは team_high を相手として返す", async () => {
      h.shareRows = [{ teamLow: "A", teamHigh: "B" }]
      expect(await getSharePartners("A")).toEqual(["B"])
    })

    it("success: team_high 側のときは team_low を相手として返す", async () => {
      h.shareRows = [{ teamLow: "A", teamHigh: "B" }]
      expect(await getSharePartners("B")).toEqual(["A"])
    })

    it("success: 共有が無ければ空配列", async () => {
      h.shareRows = []
      expect(await getSharePartners("A")).toEqual([])
    })
  })

  describe("getSharePartnersForTeams", () => {
    it("success: 自分側=key / 反対側=partner に振り分ける", async () => {
      h.shareRows = [{ teamLow: "A", teamHigh: "B" }]
      const map = await getSharePartnersForTeams(["A"])
      expect(map.get("A")).toEqual(["B"])
      expect(map.has("B")).toBe(false) // B は問い合わせ対象外なのでキーを持たない
    })

    it("success: 両端とも対象集合に含まれる共有は双方向に積む", async () => {
      h.shareRows = [{ teamLow: "A", teamHigh: "B" }]
      const map = await getSharePartnersForTeams(["A", "B"])
      expect(map.get("A")).toEqual(["B"])
      expect(map.get("B")).toEqual(["A"])
    })

    it("success: 複数の共有相手をまとめて返す", async () => {
      h.shareRows = [
        { teamLow: "A", teamHigh: "B" },
        { teamLow: "A", teamHigh: "C" },
      ]
      const map = await getSharePartnersForTeams(["A"])
      expect(map.get("A")?.sort()).toEqual(["B", "C"])
    })

    it("success: 空の teamIds では DB を引かず空 Map を返す", async () => {
      h.shareRows = [{ teamLow: "A", teamHigh: "B" }]
      const map = await getSharePartnersForTeams([])
      expect(map.size).toBe(0)
    })
  })

  // 可視判定の核心（#175）。純粋関数で非推移の不変条件を固定する。
  describe("isTeamVisible（純粋ロジック・非推移）", () => {
    it("success: 直接所属しているチームは可視", () => {
      expect(isTeamVisible(["A"], "A", [])).toBe(true)
    })

    it("success: 対象が自分の所属チームと直接共有していれば可視", () => {
      // 対象 B の共有相手に自分の所属 A が含まれる
      expect(isTeamVisible(["A"], "B", ["A", "C"])).toBe(true)
    })

    it("failure: 非推移 — A-B・B-C があっても A から C は不可視", () => {
      // 自分=A、対象=C、C の直接共有相手は B のみ（A は含まれない）→ 見えない
      expect(isTeamVisible(["A"], "C", ["B"])).toBe(false)
    })

    it("failure: 所属でも共有相手でもなければ不可視", () => {
      expect(isTeamVisible(["A"], "Z", [])).toBe(false)
    })

    it("failure: 所属チームが無いユーザーは何も見えない", () => {
      expect(isTeamVisible([], "A", ["A"])).toBe(false)
    })
  })

  // isTeamVisibleTo は getUserTeamIds + getSharePartners + isTeamVisible の合成。
  // table identity モックで A-B-C シナリオを通し、非推移を端から端まで検証する。
  describe("isTeamVisibleTo（DB 合成・非推移）", () => {
    it("success: 直接所属チームは可視（共有が無くても true）", async () => {
      h.memberRows = [{ teamId: "A" }]
      h.shareRows = []
      expect(await isTeamVisibleTo("A", "userA")).toBe(true)
    })

    it("success: 共有相手チームは可視（A は A-B 共有の B を見られる）", async () => {
      h.memberRows = [{ teamId: "A" }]
      h.shareRows = [{ teamLow: "A", teamHigh: "B" }]
      expect(await isTeamVisibleTo("B", "userA")).toBe(true)
    })

    it("failure: 非推移 — A は B-C 共有の C を見られない", async () => {
      // A は B と共有しているが、C は B としか共有していない（A-C の直接共有は無い）
      h.memberRows = [{ teamId: "A" }]
      h.shareRows = [{ teamLow: "B", teamHigh: "C" }]
      expect(await isTeamVisibleTo("C", "userA")).toBe(false)
    })

    it("failure: 無関係チームは不可視", async () => {
      h.memberRows = [{ teamId: "A" }]
      h.shareRows = []
      expect(await isTeamVisibleTo("Z", "userA")).toBe(false)
    })
  })
})
