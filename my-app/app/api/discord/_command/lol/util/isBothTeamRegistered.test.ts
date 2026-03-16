import { describe, it, expect } from "vitest"
import { isBothTeamRegistered } from "./isBothTeamRegistered"
import { MatchRules, TeamData } from "@/app/domains/lol/types"

describe("isBothTeamRegistered: ", () => {
  it("true: all rules is false", () => {
    const rules: MatchRules = {
      isProtect: false,
      isRoleSelect: false,
    }
    const team1: TeamData = { protection_champions: undefined, roster: undefined }
    const team2: TeamData = { protection_champions: undefined, roster: undefined }

    expect(isBothTeamRegistered(rules, team1, team2)).toBe(true)
  })

  it("true: isProtect & isRoleSelect", () => {
    const rules: MatchRules = {
      isProtect: true,
      isRoleSelect: true,
    }
    const team1: TeamData = { protection_champions: "aa, bb", roster: { top: "p1", jg: "p2", mid: "p3", adc: "p4", sup: "p5" } }
    const team2: TeamData = { protection_champions: "ac, bc", roster: { top: "p12", jg: "p13", mid: "p14", adc: "p15", sup: "p16" } }

    expect(isBothTeamRegistered(rules, team1, team2)).toBe(true)
  })

  it("true: isProtect", () => {
    const rules: MatchRules = {
      isProtect: true,
      isRoleSelect: true,
    }

    const team1: TeamData = { protection_champions: "aa, bb", roster: { top: "p1", jg: "p2", mid: "p3", adc: "p4", sup: "p5" } }
    const team2: TeamData = { protection_champions: "ac, bc", roster: { top: "p12", jg: "p13", mid: "p14", adc: "p15", sup: "p16" } }

    expect(isBothTeamRegistered(rules, team1, team2)).toBe(true)
  })

  it("true: isRoleSelect", () => {
    const rules: MatchRules = {
      isProtect: false,
      isRoleSelect: true,
    }

    const team1: TeamData = { protection_champions: "aa, bb", roster: { top: "p1", jg: "p2", mid: "p3", adc: "p4", sup: "p5" } }
    const team2: TeamData = { protection_champions: "ac, bc", roster: { top: "p12", jg: "p13", mid: "p14", adc: "p15", sup: "p16" } }

    expect(isBothTeamRegistered(rules, team1, team2)).toBe(true)
  })

  it("false: isProtect & isRoleSelect, but protection is empty", () => {
    const rules: MatchRules = {
      isProtect: true,
      isRoleSelect: true,
    }

    const team1: TeamData = { protection_champions: "", roster: { top: "p1", jg: "p2", mid: "p3", adc: "p4", sup: "p5" } }
    const team2: TeamData = { protection_champions: "ac, bc", roster: { top: "p12", jg: "p13", mid: "p14", adc: "p15", sup: "p16" } }

    expect(isBothTeamRegistered(rules, team1, team2)).toBe(false)
  })

  it("false: isRoleSelect, but team2 has not jg", () => {
    const rules: MatchRules = {
      isProtect: true,
      isRoleSelect: false,
    }

    const team1: TeamData = { protection_champions: "aa, bb", roster: { top: "p1", jg: "p2", mid: "p3", adc: "p4", sup: "p5" } }
    const team2: TeamData = { protection_champions: "", roster: { top: "p12", jg: "", mid: "p14", adc: "p15", sup: "p16" } }

    expect(isBothTeamRegistered(rules, team1, team2)).toBe(false)
  })
})
