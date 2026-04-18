"use client"

import { useState, useRef, useEffect } from "react"
import { ROLE_KEYS } from "@/app/_domains/lol/roleRoulette"
import { runRoleRoulette } from "@/app/_domains/lol/roleRoulette"
import type { RoleKey, RouletteResult } from "@/app/_domains/lol/roleRoulette"
import type { RoleOrFill } from "../_types"
import { buildFrames, parseNames, loadNamesFromStorage, loadSelectionsFromStorage, saveNamesToStorage, saveSelectionsToStorage } from "../_utils"
import { RoleButton } from "./RoleButton"
import { AnimationDisplay } from "./AnimationDisplay"
import { ResultDisplay } from "./ResultDisplay"

const ALL_ROLES: RoleOrFill[] = [...ROLE_KEYS, "FILL"]

export function RoleRouletteV1() {
  const [namesText, setNamesText] = useState("")
  const [roleSelections, setRoleSelections] = useState<Record<string, Set<RoleOrFill>>>({})
  const [result, setResult] = useState<RouletteResult | null>(null)
  const [animDisplayNames, setAnimDisplayNames] = useState<Record<RoleKey, string> | null>(null)
  const [lockedRoles, setLockedRoles] = useState<Set<RoleKey>>(new Set())
  const [isAnimating, setIsAnimating] = useState(false)
  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const names = parseNames(namesText)
  const duplicateNames = names.filter((name, i) => names.indexOf(name) !== i)

  useEffect(() => {
    void Promise.resolve().then(() => {
      setNamesText(loadNamesFromStorage().join("\n"))
      setRoleSelections(loadSelectionsFromStorage())
    })
  }, [])

  const clearTimeouts = () => {
    for (const id of timeoutIdsRef.current) clearTimeout(id)
    timeoutIdsRef.current = []
  }

  const handleNamesChange = (text: string) => {
    setNamesText(text)
    setResult(null)
    const newNames = new Set(parseNames(text))
    const nextSelections: Record<string, Set<RoleOrFill>> = {}
    for (const name of newNames) {
      nextSelections[name] = roleSelections[name] ?? new Set()
    }
    setRoleSelections(nextSelections)
    saveNamesToStorage(parseNames(text))
    saveSelectionsToStorage(nextSelections)
  }

  const toggleRole = (name: string, role: RoleOrFill) => {
    setResult(null)
    const current = new Set(roleSelections[name] ?? [])
    if (current.has(role)) {
      current.delete(role)
    } else {
      current.add(role)
      if (role === "FILL") {
        for (const r of ROLE_KEYS) current.delete(r)
      }
      if (role !== "FILL" && ROLE_KEYS.every((r) => current.has(r))) {
        for (const r of ROLE_KEYS) current.delete(r)
        current.add("FILL")
      }
    }
    const nextSelections = { ...roleSelections, [name]: current }
    setRoleSelections(nextSelections)
    saveSelectionsToStorage(nextSelections)
  }

  const handleStart = () => {
    clearTimeouts()

    const reactorsByRole: Record<RoleKey | "FILL", string[]> = { TOP: [], JG: [], MID: [], ADC: [], SUP: [], FILL: [] }
    for (const name of names) {
      for (const role of roleSelections[name] ?? new Set()) {
        reactorsByRole[role].push(name)
      }
    }
    const rouletteResult = runRoleRoulette(reactorsByRole, "")
    if (!rouletteResult.ok) {
      setResult(rouletteResult)
      return
    }

    const finalResult = rouletteResult
    const participants = [...names]
    const frames = buildFrames(4000)
    const totalFrames = frames.length
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
    <>
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
            <thead></thead>
            <tbody>
              {names.map((name) => (
                <tr key={name} className="border-b border-zinc-700">
                  <td className="py-2 pr-4 text-2xl w-80 max-w-80 overflow-hidden text-ellipsis whitespace-nowrap" title={name}>
                    {name}
                  </td>
                  {ALL_ROLES.map((role) => {
                    const selected = roleSelections[name]?.has(role) ?? false
                    return (
                      <td key={role} className={`text-center py-2 px-3 ${role === "FILL" ? "bg-zinc-800" : ""}`}>
                        <RoleButton name={name} role={role} selected={selected} onClick={() => toggleRole(name, role)} />
                      </td>
                    )
                  })}
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
      {duplicateNames.length > 0 && <span className="ml-3 text-red-400 text-sm">※ 名前が重複しています: {[...new Set(duplicateNames)].join(", ")}</span>}
      {duplicateNames.length === 0 && names.length > 0 && names.length < 5 && <span className="ml-3 text-zinc-400 text-sm">※ 5人以上必要です（現在 {names.length} 人）</span>}

      {isAnimating && animDisplayNames && <AnimationDisplay animDisplayNames={animDisplayNames} lockedRoles={lockedRoles} />}
      {result && <ResultDisplay result={result} />}
    </>
  )
}

