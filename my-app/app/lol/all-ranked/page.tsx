"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Image from "next/image"
import type { RankedApiResponse } from "@/app/api/web/lol/ranked/route"
import { NO_DIVISION_TIERS, PAST_SEASONS, RANK_LEGEND, SummonerResult, TIER_COLOR, TIER_SHORT } from "../types"

// ---- ユーティリティ ----

function formatRankShort(tier: string, rank: string): string {
  if (NO_DIVISION_TIERS.has(tier)) return TIER_SHORT[tier] ?? tier
  return `${TIER_SHORT[tier] ?? tier} ${rank}`
}

function rankEmblemUrl(tier: string): string {
  const name = tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase()
  return `/lol/positions/ranked_emblems/Rank=${name}.png`
}

function profileIconUrl(iconId: number): string {
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${iconId}.jpg`
}

function parseLines(text: string): string[] {
  // 改行・半角スペース・全角スペース・カンマを区切り文字として分割
  return text
    .split(/[\n ,　]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

// ---- UIコンポーネント ----

function SummonerCard({ result }: { result: SummonerResult }) {
  if (result.status === "error") {
    return (
      <div className="bg-[#1e1e2e] rounded-lg border border-red-800/50 px-4 py-4 text-sm text-red-400">
        <span className="text-zinc-300 font-medium block mb-1">{result.input}</span>
        {result.message}
      </div>
    )
  }

  const { data } = result
  const solo = data.soloEntry
  const winrate = solo && solo.wins + solo.losses > 0 ? Math.round((solo.wins / (solo.wins + solo.losses)) * 100) : null
  const tierColor = solo ? (TIER_COLOR[solo.tier] ?? "text-zinc-400") : "text-zinc-500"

  return (
    <div className="bg-[#1e1e2e] rounded-lg overflow-hidden border border-[#3a3a5c]">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 p-4 bg-[#252540] border-b border-[#3a3a5c]">
        <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-[#3a3a5c]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={profileIconUrl(data.profileIconId)} alt="profile icon" width={48} height={48} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white truncate leading-tight">{data.name}</p>
          <p className="text-xs text-zinc-400">#{data.tag}</p>
          <p className="text-xs text-zinc-500">Lv.{data.summonerLevel}</p>
        </div>
      </div>

      {/* ランク情報 */}
      <table className="w-full  text-sm border-collapse">
        <thead>
          <tr className="text-[11px] text-zinc-500 bg-[#1a1a2e]">
            <th className="px-4 py-2 text-left font-normal">シーズン</th>
            <th className="px-4 py-2 text-left font-normal">ランク</th>
            <th className="px-4 py-2 text-left font-normal">W / L</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#3a3a5c]">
          {/* 現在シーズン行 */}
          <tr>
            <td className="px-2 py-3 align-middle">
              <div className="flex flex-col gap-1">
                <span className="font-medium text-white">{new Date().getFullYear()}</span>
              </div>
            </td>
            <td className="px-2 py-3 align-middle">
              <div className="flex flex-row items-center gap-2">
                {solo && <Image src={rankEmblemUrl(solo.tier)} alt={solo.tier} width={32} height={32} className="shrink-0" />}
                <div className="flex flex-col">
                  {solo ? (
                    <>
                      <span className={`font-semibold ${tierColor}`}>{formatRankShort(solo.tier, solo.rank)}</span>
                      <span className="text-xs text-zinc-400">{solo.leaguePoints} LP</span>
                    </>
                  ) : (
                    <span className="text-zinc-500">アンランク</span>
                  )}
                </div>
              </div>
            </td>
            <td className="px-2 py-3 align-middle">
              {solo ? (
                <div className="flex flex-col">
                  <span className={`font-medium ${winrate !== null && winrate >= 50 ? "text-blue-400" : "text-red-400"}`}>{winrate ?? "—"}%</span>
                  <span className="text-xs text-zinc-500">
                    {solo.wins}W/{solo.losses}L
                  </span>
                </div>
              ) : (
                <span className="text-zinc-600">—</span>
              )}
            </td>
          </tr>

          {/* 過去シーズン行 */}
          {PAST_SEASONS.map((season) => (
            <tr key={season}>
              <td className="px-2 text-sm py-2.5 text-zinc-400">{season}</td>
              <td className="px-4 py-2.5 text-zinc-600">—</td>
              <td className="px-4 py-2.5 text-zinc-600">—</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-[10px] text-zinc-600 px-4 py-2 border-t border-[#3a3a5c]">※ 過去シーズンのデータはRiot公開APIでは取得できません</p>
    </div>
  )
}

// ---- メインページ ----

function AllRankedPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // ?summoners= からinitial valueを復元（カンマ区切り → 改行区切り）
  const initialTextarea = (searchParams.get("summoners") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .join("\n")

  const [textarea, setTextarea] = useState(initialTextarea)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SummonerResult[]>([])
  const [globalError, setGlobalError] = useState("")
  const [language, setLanguage] = useState("ja_JP")
  const [languages, setLanguages] = useState<string[]>([])

  useEffect(() => {
    fetch("https://ddragon.leagueoflegends.com/cdn/languages.json")
      .then((res) => res.json())
      .then((data: string[]) => setLanguages(data))
      .catch(() => {})
  }, [])

  const performSearch = async (lines: string[]) => {
    setLoading(true)
    setGlobalError("")
    setResults([])

    const fetched = await Promise.allSettled(
      lines.map(async (line): Promise<SummonerResult> => {
        const hashIdx = line.indexOf("#")
        const name = line.slice(0, hashIdx).trim()
        const tag = line.slice(hashIdx + 1).trim()

        try {
          const res = await fetch(`/api/web/lol/ranked?summoner=${encodeURIComponent(name)}&tag=${encodeURIComponent(tag)}`)
          const data: RankedApiResponse & { error?: string } = await res.json()
          if (!res.ok) {
            return { status: "error", input: line, message: data.error ?? "エラーが発生しました" }
          }
          return { status: "success", data }
        } catch {
          return { status: "error", input: line, message: "通信エラーが発生しました" }
        }
      }),
    )

    setResults(fetched.map((r) => (r.status === "fulfilled" ? r.value : { status: "error", input: "", message: "予期せぬエラー" })))
    setLoading(false)
  }

  // クエリパラメータがあればマウント時に自動検索
  useEffect(() => {
    const lines = parseLines(initialTextarea)
    if (lines.length > 0 && lines.every((l) => l.includes("#"))) {
      void performSearch(lines)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = async () => {
    const lines = parseLines(textarea)
    if (lines.length === 0) {
      setGlobalError("サモナーを1行以上入力してください")
      return
    }

    const invalid = lines.filter((l) => !l.includes("#"))
    if (invalid.length > 0) {
      setGlobalError(`以下の行が 名前#タグ の形式になっていません: ${invalid.join(", ")}`)
      return
    }

    // URL に ?summoners= として保存
    router.replace(`?summoners=${lines.map(encodeURIComponent).join(",")}`, { scroll: false })

    await performSearch(lines)
  }

  const lineCount = parseLines(textarea).length

  return (
    <div className="min-h-screen bg-[#0f0e17] text-white font-sans">
      <div className="max-w-7xl mx-auto px-4 py-10">
        {/* ヘッダー */}
        <h1 className="text-2xl font-bold text-center mb-8 text-[#c89b3c] tracking-wide">LoL ランク履歴</h1>

        {/* 検索フォーム */}
        <div className="mb-8 max-w-3xl mx-auto">
          <textarea
            className="w-full bg-[#1e1e2e] border border-[#3a3a5c] rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#c89b3c] transition-colors resize-none h-36 font-mono text-sm"
            placeholder={"madora#3012\nANIMA0135#7786\nFigo#JP1"}
            value={textarea}
            onChange={(e) => setTextarea(e.target.value)}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-zinc-500">{lineCount > 0 ? `${lineCount}人` : "1行に1サモナー（名前#タグ）"}</span>
            <button
              className="bg-[#c89b3c] hover:bg-[#d4aa50] active:bg-[#b88a2c] text-black font-bold px-6 py-2 rounded-lg disabled:opacity-50 transition-colors text-sm"
              onClick={handleSearch}
              disabled={loading || !textarea.trim()}
            >
              {loading ? "検索中..." : "検索"}
            </button>
          </div>
        </div>

        {/* グローバルエラー */}
        {globalError && <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-6 text-sm max-w-3xl mx-auto">{globalError}</div>}

        {/* 結果エリア */}
        {results.length > 0 && (
          <>
            {/* サマリーバー */}
            <div className="mb-4 p-3 bg-[#1e1e2e] rounded-lg border border-[#3a3a5c] flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">サモナー数:</span>
                <span className="font-bold text-[#c89b3c]">{results.length}</span>
              </div>
              <div className="w-px h-4 bg-[#3a3a5c]" />
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">サーバー:</span>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className="bg-[#1e1e2e] text-white text-sm border border-[#3a3a5c] rounded px-2 py-0.5">
                  {languages.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* グリッド */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-5 gap-1.5 xl:gap-4">
              {results.map((result, i) => (
                <SummonerCard key={i} result={result} />
              ))}
            </div>

            {/* ランク凡例 */}
            <div className="mt-8 p-4 bg-[#1e1e2e] rounded-lg border border-[#3a3a5c]">
              <h2 className="text-xs font-semibold text-zinc-400 mb-3">ランク凡例</h2>
              <div className="flex flex-wrap gap-2 text-xs">
                {RANK_LEGEND.map((rank) => (
                  <div key={rank.short} className="flex items-center gap-1.5 px-2 py-1 bg-[#252540] rounded">
                    <span className={`font-bold ${rank.color}`}>{rank.short}</span>
                    <span className="text-zinc-400">{rank.full}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function AllRankedPage() {
  return (
    <Suspense>
      <AllRankedPageInner />
    </Suspense>
  )
}
