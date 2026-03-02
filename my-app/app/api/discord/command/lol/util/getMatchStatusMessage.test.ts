import { describe, it, expect } from "vitest"
import { RegisteredStatus, registeredStatus } from "./getMatchStatusMessage"
import { ProtectMatchMeta, ProtectTeamData } from "@/app/domains/lol/types"
import { newId } from "@/app/_server/util/newId"

describe("getMatchStatusMessage: ", () => {
  const now = new Date()
  describe("registeredStatus: ", () => {
    it("success: both did", () => {
      const meta: ProtectMatchMeta = {
        created_at: now.toISOString(),
        isProtect: true,
        isRoleSelect: true,
        match_id: newId(),
        members: {
          blueTeam: ["b1", "b2", "b3", "b4", "b5"],
          redTeam: ["r1", "r2", "r3", "r4", "r5"],
        },
      }
      const blueTeamData: ProtectTeamData = {
        updated_at: new Date(now.getTime() + 5 * 60 + 10000).toISOString(),
        protection_champions: "あああ、ｂｂｂ",
        roster: {
          adc: "b1",
          jg: "b2",
          mid: "b3",
          sup: "b4",
          top: "b5",
        },
      }
      const redTeamData: ProtectTeamData = {
        updated_at: new Date(now.getTime() + 5 * 60 + 10000).toISOString(),
        protection_champions: "えええ、ううう",
        roster: {
          adc: "r1",
          jg: "r2",
          mid: "r3",
          sup: "r4",
          top: "r5",
        },
      }

      const result: RegisteredStatus = registeredStatus({ meta, redTeamData, blueTeamData })
      expect(result).toBe("bothDid")
    })
  })

  it("success: only red did", () => {
    const meta: ProtectMatchMeta = {
      created_at: now.toISOString(),
      isProtect: true,
      isRoleSelect: true,
      match_id: newId(),
      members: {
        blueTeam: ["b1", "b2", "b3", "b4", "b5"],
        redTeam: ["r1", "r2", "r3", "r4", "r5"],
      },
    }
    const blueTeamData = null
    const redTeamData: ProtectTeamData = {
      updated_at: new Date(now.getTime() + 5 * 60 + 10000).toISOString(),
      protection_champions: "えええ、ううう",
      roster: {
        adc: "r1",
        jg: "r2",
        mid: "r3",
        sup: "r4",
        top: "r5",
      },
    }

    const result: RegisteredStatus = registeredStatus({ meta, redTeamData, blueTeamData })
    expect(result).toBe("OnlyRedDid")
  })

  it("success: only red did", () => {
    const meta: ProtectMatchMeta = {
      created_at: now.toISOString(),
      isProtect: true,
      isRoleSelect: true,
      match_id: newId(),
      members: {
        blueTeam: ["b1", "b2", "b3", "b4", "b5"],
        redTeam: ["r1", "r2", "r3", "r4", "r5"],
      },
    }
    const blueTeamData: ProtectTeamData = {
      updated_at: new Date(now.getTime() + 5 * 60 + 10000).toISOString(),
      protection_champions: "えええ、ううう",
      roster: {
        adc: "r1",
        jg: "r2",
        mid: "r3",
        sup: "r4",
        top: "r5",
      },
    }
    const redTeamData = null

    const result: RegisteredStatus = registeredStatus({ meta, redTeamData, blueTeamData })
    expect(result).toBe("OnlyBlueDid")
  })
})
