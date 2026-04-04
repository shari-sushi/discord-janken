import { NextRequest, NextResponse } from "next/server"
import { RIOT_API_KEY, RIOT_API_REVALIDATE_SECONDS } from "@/app/_server/lib/env"

type LeagueEntryDTO = {
  queueType: string
  tier: string
  rank: string
  leaguePoints: number
  wins: number
  losses: number
  inactive: boolean
}

type SummonerDTO = {
  profileIconId: number
  summonerLevel: number
}

export type RankedApiResponse = {
  name: string
  tag: string
  profileIconId: number
  summonerLevel: number
  soloEntry: LeagueEntryDTO | null
}

async function riotFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: { "X-Riot-Token": RIOT_API_KEY },
    next: { revalidate: RIOT_API_REVALIDATE_SECONDS },
  })
}

export async function GET(req: NextRequest) {
  if (!RIOT_API_KEY) {
    return NextResponse.json({ error: "Riot API keyが設定されていません" }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const name = searchParams.get("summoner")
  const tag = searchParams.get("tag")

  if (!name || !tag) {
    return NextResponse.json({ error: "summoner と tag は必須です" }, { status: 400 })
  }

  try {
    // 1. Riot IDからPUUIDを取得
    const accountRes = await riotFetch(`https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`)

    if (!accountRes.ok) {
      if (accountRes.status === 404) {
        return NextResponse.json({ error: "サモナーが見つかりませんでした" }, { status: 404 })
      }
      return NextResponse.json({ error: `Riot APIエラー (${accountRes.status})` }, { status: 500 })
    }

    const account: { puuid: string } = await accountRes.json()

    // 2. PUUIDからサモナー情報を取得
    const summonerRes = await riotFetch(`https://jp1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${account.puuid}`)

    if (!summonerRes.ok) {
      return NextResponse.json({ error: `サモナー情報の取得に失敗しました (${summonerRes.status})` }, { status: 500 })
    }

    const summoner: SummonerDTO = await summonerRes.json()

    // 3. ランクエントリを取得
    const leagueRes = await riotFetch(`https://jp1.api.riotgames.com/lol/league/v4/entries/by-puuid/${account.puuid}`)

    if (!leagueRes.ok) {
      return NextResponse.json({ error: `ランク情報の取得に失敗しました (${leagueRes.status})` }, { status: 500 })
    }

    const entries: LeagueEntryDTO[] = await leagueRes.json()
    const soloEntry = entries.find((e) => e.queueType === "RANKED_SOLO_5x5") ?? null

    return NextResponse.json({
      name,
      tag,
      profileIconId: summoner.profileIconId,
      summonerLevel: summoner.summonerLevel,
      soloEntry,
    } satisfies RankedApiResponse)
  } catch (e) {
    console.error("[/api/web/lol/ranked] unexpected error:", e)
    return NextResponse.json({ error: `予期せぬエラー: ${String(e)}` }, { status: 500 })
  }
}
