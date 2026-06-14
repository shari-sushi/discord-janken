import { RankedApiResponse } from "../api/web/lol/ranked/route"

export const TIER_COLOR: Record<string, string> = {
  IRON: "text-[#6b5b4f]",
  BRONZE: "text-[#a77044]",
  SILVER: "text-[#7c8e9a]",
  GOLD: "text-[#f0b048]",
  PLATINUM: "text-[#2d9b87]",
  EMERALD: "text-[#2ecc71]",
  DIAMOND: "text-[#576cbe]",
  MASTER: "text-[#9d4dc5]",
  GRANDMASTER: "text-[#cd4545]",
  CHALLENGER: "text-[#f4c874]",
}

export const TIER_SHORT: Record<string, string> = {
  IRON: "Iro",
  BRONZE: "Bro",
  SILVER: "Sil",
  GOLD: "Gol",
  PLATINUM: "Pla",
  EMERALD: "Eme",
  DIAMOND: "Dia",
  MASTER: "Mas",
  GRANDMASTER: "GrM",
  CHALLENGER: "Cha",
}

export const NO_DIVISION_TIERS = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"])

export const PAST_SEASONS = ["S2025", "S2024", "S2023", "S2022", "S2021", "S2020", "S2019", "S2018", "S2017", "S2016", "S2015", "S2014", "S2013"]

export const RANK_LEGEND = [
  { short: "I", full: "Iron", color: "text-[#6b5b4f]" },
  { short: "B", full: "Bronze", color: "text-[#a77044]" },
  { short: "S", full: "Silver", color: "text-[#7c8e9a]" },
  { short: "G", full: "Gold", color: "text-[#f0b048]" },
  { short: "P", full: "Platinum", color: "text-[#2d9b87]" },
  { short: "E", full: "Emerald", color: "text-[#2ecc71]" },
  { short: "D", full: "Diamond", color: "text-[#576cbe]" },
  { short: "M", full: "Master", color: "text-[#9d4dc5]" },
  { short: "GM", full: "Grandmaster", color: "text-[#cd4545]" },
  { short: "C", full: "Challenger", color: "text-[#f4c874]" },
]

export type SummonerResult = { status: "success"; data: RankedApiResponse } | { status: "error"; input: string; message: string }
