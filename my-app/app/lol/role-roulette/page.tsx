"use client"
import { useState, useRef } from "react"
import { ROLE_KEYS, ROLE_LABELS, runRoleRoulette } from "@/app/domains/lol/roleRoulette"
import type { RoleKey, RouletteResult } from "@/app/domains/lol/roleRoulette"

type RoleOrFill = RoleKey | "FILL"
const ALL_ROLES: RoleOrFill[] = [...ROLE_KEYS, "FILL"]
const ROLE_DISPLAY: Record<RoleOrFill, string> = { ...ROLE_LABELS, FILL: "FILL" }

// アニメーションのフレームタイムスタンプを生成（指数的に遅くなる）
function buildFrames(durationMs: number): number[] {
  const frames: number[] = []
  let t = 0
  let dt = 40
  while (t < durationMs) {
    frames.push(t)
    t += dt
    dt = Math.min(dt * 1.07, 500)
  }
  return frames
}

function parseNames(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export default function RoleRoulettePage() {
  const [namesText, setNamesText] = useState("")
  const [roleSelections, setRoleSelections] = useState<Record<string, Set<RoleOrFill>>>({})
  const [result, setResult] = useState<RouletteResult | null>(null)
  const [animDisplayNames, setAnimDisplayNames] = useState<Record<RoleKey, string> | null>(null)
  const [lockedRoles, setLockedRoles] = useState<Set<RoleKey>>(new Set())
  const [isAnimating, setIsAnimating] = useState(false)
  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const names = parseNames(namesText)
  const duplicateNames = names.filter((name, i) => names.indexOf(name) !== i)

  const clearTimeouts = () => {
    for (const id of timeoutIdsRef.current) clearTimeout(id)
    timeoutIdsRef.current = []
  }

  const handleNamesChange = (text: string) => {
    setNamesText(text)
    setResult(null)
    // 消えた名前のチェック状態を削除
    const newNames = new Set(parseNames(text))
    setRoleSelections((prev) => {
      const next: Record<string, Set<RoleOrFill>> = {}
      for (const name of newNames) {
        next[name] = prev[name] ?? new Set()
      }
      return next
    })
  }

  const toggleRole = (name: string, role: RoleOrFill) => {
    setResult(null)
    setRoleSelections((prev) => {
      const current = new Set(prev[name] ?? [])
      if (current.has(role)) {
        current.delete(role)
      } else {
        current.add(role)
        // FILLを追加したらTOP〜SUPを全て外す
        if (role === "FILL") {
          for (const r of ROLE_KEYS) current.delete(r)
        }
        // TOP〜SUP全て揃ったらFILLに切り替え
        if (role !== "FILL" && ROLE_KEYS.every((r) => current.has(r))) {
          for (const r of ROLE_KEYS) current.delete(r)
          current.add("FILL")
        }
      }
      return { ...prev, [name]: current }
    })
  }

  const handleStart = () => {
    clearTimeouts()

    const reactorsByRole: Record<RoleKey | "FILL", string[]> = {
      TOP: [],
      JG: [],
      MID: [],
      ADC: [],
      SUP: [],
      FILL: [],
    }
    for (const name of names) {
      const selected = roleSelections[name] ?? new Set()
      for (const role of selected) {
        reactorsByRole[role].push(name)
      }
    }
    // Web版ではBot除外不要のため空文字を渡す
    const rouletteResult = runRoleRoulette(reactorsByRole, "")

    // エラーは即時表示
    if (!rouletteResult.ok) {
      setResult(rouletteResult)
      return
    }

    // アニメーション開始
    const finalResult = rouletteResult
    const participants = [...names]
    const frames = buildFrames(4000)
    const totalFrames = frames.length

    // ロール確定フレーム（TOP→JG→MID→ADC→SUPの順に確定）
    const lockAtFrame: Record<RoleKey, number> = {
      TOP: Math.floor(totalFrames * 0.55),
      JG: Math.floor(totalFrames * 0.65),
      MID: Math.floor(totalFrames * 0.75),
      ADC: Math.floor(totalFrames * 0.85),
      SUP: totalFrames - 1,
    }

    setIsAnimating(true)
    setResult(null)
    setLockedRoles(new Set())

    // 各フレームの表示名をオブジェクトとして共有（クロージャで参照）
    const currentDisplay: Record<RoleKey, string> = { TOP: "", JG: "", MID: "", ADC: "", SUP: "" }

    frames.forEach((time, frameIdx) => {
      const id = setTimeout(() => {
        const newLocked = new Set<RoleKey>()
        for (const role of ROLE_KEYS) {
          if (frameIdx >= lockAtFrame[role]) {
            currentDisplay[role] = finalResult.assignment[role]
            newLocked.add(role)
          } else {
            currentDisplay[role] = participants[Math.floor(Math.random() * participants.length)]
          }
        }
        setAnimDisplayNames({ ...currentDisplay })
        setLockedRoles(newLocked)

        // 最終フレーム後に結果を表示
        if (frameIdx === totalFrames - 1) {
          const finalId = setTimeout(() => {
            setIsAnimating(false)
            setAnimDisplayNames(null)
            setLockedRoles(new Set())
            setResult(finalResult)
          }, 600)
          timeoutIdsRef.current.push(finalId)
        }
      }, time)
      timeoutIdsRef.current.push(id)
    })
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">ロールルーレット</h1>

      <div className="mb-6">
        <label className="block mb-2 font-semibold">参加者（1行1人）</label>
        <textarea
          className="w-full border border-zinc-500 bg-zinc-800 text-white px-3 py-2 rounded h-48 resize-y"
          value={namesText}
          onChange={(e) => handleNamesChange(e.target.value)}
          placeholder={"player1\nplayer2\nplayer3\nplayer4\nplayer5"}
        />
      </div>

      {names.length > 0 && (
        <div className="mb-6 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-zinc-600">
                <th className="text-left py-2 pr-4 font-semibold">名前</th>
                {ALL_ROLES.map((role) => (
                  <th key={role} className={`text-center py-2 px-3 font-semibold w-14${role === "FILL" ? " bg-zinc-800" : ""}`}>
                    {ROLE_DISPLAY[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {names.map((name) => (
                <tr key={name} className="border-b border-zinc-700">
                  <td className="py-2 pr-4">{name}</td>
                  {ALL_ROLES.map((role) => (
                    <td key={role} className={`text-center py-2 px-3${role === "FILL" ? " bg-zinc-800" : ""}`}>
                      <input type="checkbox" className="w-4 h-4 cursor-pointer accent-blue-500" checked={roleSelections[name]?.has(role) ?? false} onChange={() => toggleRole(name, role)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        className="bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2 rounded mb-6"
        onClick={handleStart}
        disabled={names.length < 5 || duplicateNames.length > 0 || isAnimating}
      >
        {isAnimating ? "抽選中..." : "抽選開始"}
      </button>
      {duplicateNames.length > 0 && (
        <span className="ml-3 text-red-400 text-sm">※ 名前が重複しています: {[...new Set(duplicateNames)].join(", ")}</span>
      )}
      {duplicateNames.length === 0 && names.length > 0 && names.length < 5 && <span className="ml-3 text-zinc-400 text-sm">※ 5人以上必要です（現在 {names.length} 人）</span>}

      {/* アニメーション表示 */}
      {isAnimating && animDisplayNames && (
        <div className="p-4 rounded border border-blue-600 bg-blue-900/20">
          <p className="font-semibold mb-3 text-blue-300">抽選中...</p>
          <ul className="space-y-2">
            {ROLE_KEYS.map((role) => (
              <li key={role} className="flex items-center gap-3">
                <span className="inline-block w-12 font-semibold text-zinc-400">{ROLE_LABELS[role]}</span>
                <span
                  className={`font-mono text-lg min-w-24 transition-colors duration-150 ${
                    lockedRoles.has(role) ? "text-green-400 font-bold" : "text-zinc-500"
                  }`}
                >
                  {animDisplayNames[role]}
                </span>
                {lockedRoles.has(role) && <span className="text-green-500 text-sm">✓</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 確定結果表示 */}
      {result && (
        <div className={`p-4 rounded border ${result.ok ? "border-green-600 bg-green-900/30" : "border-red-600 bg-red-900/30"}`}>
          {result.ok ? (
            <>
              <p className="font-semibold mb-2">抽選結果</p>
              <ul className="space-y-1">
                {ROLE_KEYS.map((role) => (
                  <li key={role}>
                    <span className="inline-block w-12 font-semibold">{ROLE_LABELS[role]}</span>
                    {result.assignment[role]}
                  </li>
                ))}
                {result.rest.length > 0 && (
                  <li>
                    <span className="inline-block w-12 font-semibold text-zinc-400">休憩</span>
                    <span className="text-zinc-400">{result.rest.join(", ")}</span>
                  </li>
                )}
              </ul>
            </>
          ) : (
            <p className="text-red-400">{result.error}</p>
          )}
        </div>
      )}
    </div>
  )
}
