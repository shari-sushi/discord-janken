import { describe, it, expect } from "vitest"
import { runRoleRoulette } from "./roleRoulette"
import type { RoleKey } from "./roleRoulette"

const BOT_ID = "bot-id"

// 全ロールに全員がリアクション済み（被りなし）の reactorsByRole を返すヘルパー
function makeReactors(userIds: string[], roles: (RoleKey | "FILL")[]): Record<RoleKey | "FILL", string[]> {
  return {
    TOP: roles.includes("TOP") ? userIds : [],
    JG: roles.includes("JG") ? userIds : [],
    MID: roles.includes("MID") ? userIds : [],
    ADC: roles.includes("ADC") ? userIds : [],
    SUP: roles.includes("SUP") ? userIds : [],
    FILL: roles.includes("FILL") ? userIds : [],
  }
}

describe("runRoleRoulette", () => {
  it("success: 5人ちょうどで全員希望ロールが被らない場合に正しく割り当て", () => {
    const reactorsByRole = {
      TOP: ["u1"],
      JG: ["u2"],
      MID: ["u3"],
      ADC: ["u4"],
      SUP: ["u5"],
      FILL: [],
    }
    const result = runRoleRoulette(reactorsByRole, BOT_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // 全ロールに1人ずつ割り当てられている
    expect(Object.keys(result.assignment)).toHaveLength(5)
    expect(result.assignment.TOP).toBe("u1")
    expect(result.assignment.JG).toBe("u2")
    expect(result.assignment.MID).toBe("u3")
    expect(result.assignment.ADC).toBe("u4")
    expect(result.assignment.SUP).toBe("u5")
    expect(result.rest).toHaveLength(0)
  })

  it("success: fill参加者が任意のロールに割り当てられる", () => {
    const reactorsByRole = {
      TOP: ["u1"],
      JG: ["u2"],
      MID: ["u3"],
      ADC: ["u4"],
      SUP: [],
      FILL: ["u5"], // u5はFILLのみリアクション → SUPに割り当てられるはず
    }
    const result = runRoleRoulette(reactorsByRole, BOT_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.assignment.SUP).toBe("u5")
    expect(result.rest).toHaveLength(0)
  })

  it("success: 7人参加の場合、5人が割り当てられ2人が休憩に入る", () => {
    // 全員が全ロールOK
    const users = ["u1", "u2", "u3", "u4", "u5", "u6", "u7"]
    const reactorsByRole = makeReactors(users, ["TOP", "JG", "MID", "ADC", "SUP"])

    const result = runRoleRoulette(reactorsByRole, BOT_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // 5人が各ロールに割り当てられ、2人が休憩
    expect(Object.keys(result.assignment)).toHaveLength(5)
    const assignedIds = new Set(Object.values(result.assignment))
    expect(assignedIds.size).toBe(5)
    expect(result.rest).toHaveLength(2)

    // 割り当てと休憩が重複しない
    for (const restId of result.rest) {
      expect(assignedIds.has(restId)).toBe(false)
    }
  })

  it("failure: あるロールに人間のリアクションがない場合のエラー", () => {
    // 5人いるがSUPとFILLに誰もリアクションしていない
    const reactorsByRole = {
      TOP: ["u1", "u2"],
      JG: ["u3"],
      MID: ["u4"],
      ADC: ["u5"],
      SUP: [], // SUPに誰もリアクションしていない、FILLも空
      FILL: [],
    }
    const result = runRoleRoulette(reactorsByRole, BOT_ID)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain("SUP")
  })

  it("failure: 参加者が4人以下の場合のエラー", () => {
    const reactorsByRole = {
      TOP: ["u1"],
      JG: ["u2"],
      MID: ["u3"],
      ADC: ["u4"],
      SUP: [],
      FILL: [],
    }
    const result = runRoleRoulette(reactorsByRole, BOT_ID)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain("5人")
  })

  it("failure: 参加者は5人以上だが有効な割り当てが存在しない場合のエラー", () => {
    // 5人いるが、全員TOPにしかリアクションしていない
    const reactorsByRole = {
      TOP: ["u1", "u2", "u3", "u4", "u5"],
      JG: [],
      MID: [],
      ADC: [],
      SUP: [],
      FILL: [],
    }
    const result = runRoleRoulette(reactorsByRole, BOT_ID)

    // JG/MID/ADC/SUPができる人がいない → バリデーション②でエラー
    expect(result.ok).toBe(false)
  })

  it("success: Bot IDのリアクションが除外される", () => {
    const reactorsByRole = {
      TOP: [BOT_ID, "u1"],
      JG: ["u2"],
      MID: ["u3"],
      ADC: ["u4"],
      SUP: ["u5"],
      FILL: [],
    }
    const result = runRoleRoulette(reactorsByRole, BOT_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Bot IDが割り当てられていない
    const assignedIds = Object.values(result.assignment)
    expect(assignedIds).not.toContain(BOT_ID)
  })
})
