import { describe, it, expect } from "vitest"
import { createSingleTeamRegistrationMessage } from "./createSingleTeamRegistrationEmbedData"
import { RegisteredTeamData, ProtectMatchMeta } from "@/app/domains/lol/types"
import { newId } from "@/app/_server/util/newId"

describe("createSingleTeamRegistrationMessage", () => {
  const now = new Date()

  describe("success: { isProtect: true, isRoleSelect: false }", () => {
    it("success: blue_team with protect only", () => {
      const meta: ProtectMatchMeta = {
        match_id: newId(),
        rules: {
          isProtect: true,
          isRoleSelect: false,
        },
        created_at: now.toISOString(),
      }
      const teamData: RegisteredTeamData = {
        protection_champions: "ポッピー、ケイト",
        updated_at: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
      }

      const result = createSingleTeamRegistrationMessage("blue_team", meta, teamData)

      expect(result).toBeDefined()
      expect(result?.content).toBe("✅ ブルーサイド登録完了\nプロテクト：ポッピー、ケイト")
    })

    it("success: red_team with protect only", () => {
      const meta: ProtectMatchMeta = {
        match_id: newId(),
        rules: {
          isProtect: true,
          isRoleSelect: false,
        },
        created_at: now.toISOString(),
      }
      const teamData: RegisteredTeamData = {
        protection_champions: "ヴェルコズ、ニーコ",
        updated_at: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
      }

      const result = createSingleTeamRegistrationMessage("red_team", meta, teamData)

      expect(result).toBeDefined()
      expect(result?.content).toBe("✅ レッドサイド登録完了\nプロテクト：ヴェルコズ、ニーコ")
    })
  })

  describe("success: { isProtect: true, isRoleSelect: true }", () => {
    it("success: blue_team with protect and roster", () => {
      const blueTeam = ["blueA", "blueB", "blueC", "blueD", "blueE"]
      const redTeam = ["redA", "redB", "redC", "redD", "redE"]

      const meta: ProtectMatchMeta = {
        match_id: newId(),
        rules: {
          isProtect: true,
          isRoleSelect: true,
        },
        members: {
          blueTeam,
          redTeam,
        },
        created_at: now.toISOString(),
      }
      const teamData: RegisteredTeamData = {
        protection_champions: "ポッピー、ケイト",
        updated_at: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
        roster: {
          top: blueTeam[2],
          jg: blueTeam[3],
          mid: blueTeam[4],
          adc: blueTeam[1],
          sup: blueTeam[0],
        },
      }

      const result = createSingleTeamRegistrationMessage("blue_team", meta, teamData)

      expect(result).toBeDefined()
      const expectedContent = `✅ ブルーサイド登録完了\nプロテクト：ポッピー、ケイト\nTOP：${blueTeam[2]}\nJG：${blueTeam[3]}\nMID：${blueTeam[4]}\nADC：${blueTeam[1]}\nSUP：${blueTeam[0]}`
      expect(result?.content).toBe(expectedContent)
    })
  })

  describe("success: { isProtect: false, isRoleSelect: true }", () => {
    it("success: blue_team with roster only", () => {
      const blueTeam = ["blueA", "blueB", "blueC", "blueD", "blueE"]
      const redTeam = ["redA", "redB", "redC", "redD", "redE"]

      const meta: ProtectMatchMeta = {
        match_id: newId(),
        rules: {
          isProtect: false,
          isRoleSelect: true,
        },
        members: {
          blueTeam,
          redTeam,
        },
        created_at: now.toISOString(),
      }
      const teamData: RegisteredTeamData = {
        updated_at: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
        roster: {
          top: blueTeam[0],
          jg: blueTeam[1],
          mid: blueTeam[2],
          adc: blueTeam[3],
          sup: blueTeam[4],
        },
      }

      const result = createSingleTeamRegistrationMessage("blue_team", meta, teamData)

      expect(result).toBeDefined()
      const expectedContent = `✅ ブルーサイド登録完了\nTOP：${blueTeam[0]}\nJG：${blueTeam[1]}\nMID：${blueTeam[2]}\nADC：${blueTeam[3]}\nSUP：${blueTeam[4]}`
      expect(result?.content).toBe(expectedContent)
      expect(result?.content).not.toContain("プロテクト")
    })
  })

  describe("failure: invalid roster data", () => {
    it("failure: red team selects blue team roster", () => {
      const blueTeam = ["blueA", "blueB", "blueC", "blueD", "blueE"]
      const redTeam = ["redA", "redB", "redC", "redD", "redE"]

      const meta: ProtectMatchMeta = {
        match_id: newId(),
        rules: {
          isProtect: true,
          isRoleSelect: true,
        },
        members: {
          blueTeam,
          redTeam,
        },
        created_at: now.toISOString(),
      }
      const teamData: RegisteredTeamData = {
        protection_champions: "ポッピー、ケイト",
        updated_at: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
        roster: {
          top: blueTeam[0],
          jg: blueTeam[1],
          mid: blueTeam[2],
          adc: blueTeam[3],
          sup: "blueF",
        },
      }

      const result = createSingleTeamRegistrationMessage("red_team", meta, teamData)

      expect(result).toBeUndefined()
    })
  })
})
