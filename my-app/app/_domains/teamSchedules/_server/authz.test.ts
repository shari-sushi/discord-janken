import { describe, it, expect, beforeEach, vi } from "vitest"

// 上限判定（canCreateTeam / canJoinTeam）と許可ユーザー判定（isAllowlistedCreator）の境界を
// DB なしで直接検証する。route 単体テストでは canCreateTeam/canJoinTeam を丸ごとモックしており、
// 「< MAX を <= に書き間違える」「既所属の冪等を落とす」といった核心バグは route テストでは緑のまま通るため、
// ここで純粋に近い判定ロジックを固定する。
const h = vi.hoisted(() => ({
  teamIds: [] as string[],
  discordRows: [] as { discordUserId: string }[],
}))

// 所属チーム ID は shares.getUserTeamIds 経由で引かれる
vi.mock("./shares", () => ({
  getUserTeamIds: () => Promise.resolve(h.teamIds),
}))

// 許可リストは env から（モジュール読み込み時に Set 化される）。bypass 経路を踏むため値を固定する
vi.mock("@/app/_server/lib/env", () => ({
  TEAM_SCHEDULE_CREATOR_DISCORD_IDS: "discord-allow-1",
}))

// isAllowlistedCreator が引く discord_links 用。session 系は本テストでは使わないため最小モック
vi.mock("./session", () => ({ getUserIdFromSession: () => Promise.resolve(null) }))
vi.mock("@/app/_server/lib/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => Promise.resolve(h.discordRows) }) }),
  },
}))

import { canCreateTeam, canJoinTeam, isAllowlistedCreator } from "./authz"
import { MAX_TEAMS_PER_USER } from "@/app/_domains/teamSchedules/types"

beforeEach(() => {
  h.teamIds = []
  h.discordRows = []
})

describe("teamSchedules authz - 上限判定", () => {
  describe("canCreateTeam", () => {
    it("success: 所属0なら作成できる", async () => {
      h.teamIds = []
      expect(await canCreateTeam("user-1")).toBe(true)
    })

    it("success: 所属が上限-1なら作成できる（境界の内側）", async () => {
      h.teamIds = Array.from({ length: MAX_TEAMS_PER_USER - 1 }, (_, i) => `t${i}`)
      expect(await canCreateTeam("user-1")).toBe(true)
    })

    it("failure: 所属がちょうど上限なら、許可ユーザーでなければ作成できない（< の境界）", async () => {
      h.teamIds = Array.from({ length: MAX_TEAMS_PER_USER }, (_, i) => `t${i}`)
      h.discordRows = [] // 許可リストに無い
      expect(await canCreateTeam("user-1")).toBe(false)
    })

    it("success: 上限到達でも許可ユーザー（env の discord ID を持つ）は作成できる", async () => {
      h.teamIds = Array.from({ length: MAX_TEAMS_PER_USER }, (_, i) => `t${i}`)
      h.discordRows = [{ discordUserId: "discord-allow-1" }]
      expect(await canCreateTeam("user-1")).toBe(true)
    })
  })

  describe("canJoinTeam", () => {
    it("success: 既に当該チームに所属していれば、上限到達でも冪等で参加できる", async () => {
      h.teamIds = Array.from({ length: MAX_TEAMS_PER_USER }, (_, i) => `t${i}`)
      expect(await canJoinTeam("user-1", "t0")).toBe(true)
    })

    it("success: 未所属でも所属数が上限未満なら参加できる", async () => {
      h.teamIds = Array.from({ length: MAX_TEAMS_PER_USER - 1 }, (_, i) => `t${i}`)
      expect(await canJoinTeam("user-1", "other")).toBe(true)
    })

    it("failure: 未所属で上限到達かつ許可ユーザーでなければ参加できない", async () => {
      h.teamIds = Array.from({ length: MAX_TEAMS_PER_USER }, (_, i) => `t${i}`)
      h.discordRows = []
      expect(await canJoinTeam("user-1", "other")).toBe(false)
    })

    it("success: 未所属で上限到達でも許可ユーザーは参加できる", async () => {
      h.teamIds = Array.from({ length: MAX_TEAMS_PER_USER }, (_, i) => `t${i}`)
      h.discordRows = [{ discordUserId: "discord-allow-1" }]
      expect(await canJoinTeam("user-1", "other")).toBe(true)
    })
  })

  describe("isAllowlistedCreator", () => {
    it("success: 紐づく discord ID が許可リストに含まれれば true", async () => {
      h.discordRows = [{ discordUserId: "discord-allow-1" }]
      expect(await isAllowlistedCreator("user-1")).toBe(true)
    })

    it("failure: 許可リストに無い discord ID なら false", async () => {
      h.discordRows = [{ discordUserId: "discord-other" }]
      expect(await isAllowlistedCreator("user-1")).toBe(false)
    })
  })
})
