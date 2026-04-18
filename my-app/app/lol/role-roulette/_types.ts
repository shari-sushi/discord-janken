import type { RoleKey } from "@/app/_domains/lol/roleRoulette"
import { ROLE_LABELS } from "@/app/_domains/lol/roleRoulette"

export type RoleOrFill = RoleKey | "FILL"

export const ROLE_ICON: Record<RoleOrFill, string> = {
  TOP: "/lol/positions/position-top.svg",
  JG: "/lol/positions/position-jungle.svg",
  MID: "/lol/positions/position-middle.svg",
  ADC: "/lol/positions/position-bottom.svg",
  SUP: "/lol/positions/position-utility.svg",
  FILL: "/lol/positions/icon-position-fill.png",
}

export const ROLE_DISPLAY: Record<RoleOrFill, string> = { ...ROLE_LABELS, FILL: "FILL" }

export const VERSIONS = [
  { id: "1", label: "textarea版" },
  { id: "2", label: "input版" },
] as const

export type VersionId = (typeof VERSIONS)[number]["id"]
