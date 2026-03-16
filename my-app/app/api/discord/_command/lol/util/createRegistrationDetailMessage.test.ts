import { describe, it, expect } from "vitest"
import { createRegistrationDetailMessage } from "./createRegistrationDetailMessage"
import { RegisteredTeamData, ProtectMatchMeta } from "@/app/domains/lol/types"
import { newId } from "@/app/_server/util/newId"

describe("createRegistrationDetailMessage: { isProtect: true, isRoleSelect: true }", () => {
  const now = new Date()
  it("success: blue_team roster", () => {
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
    const message = createRegistrationDetailMessage("blue_team", meta, teamData)

    expect(message).toMatch(
      "✅ ブルーサイド登録完了\n" +
        "\n" + //  改行維持のためのコメント
        "【プロテクト】\n" +
        "ポッピー、ケイト\n" +
        "\n" +
        "【ロール振り分け】\n" +
        `TOP: ${blueTeam[2]}\n` +
        `JG: ${blueTeam[3]}\n` +
        `MID: ${blueTeam[4]}\n` +
        `ADC: ${blueTeam[1]}\n` +
        `SUP: ${blueTeam[0]}`,
    )
  })

  it("failure: red team select blue team roster", () => {
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
    const message = createRegistrationDetailMessage("red_team", meta, teamData)

    expect(message).toBeUndefined()
  })
})
