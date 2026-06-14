"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { ROLE_KEYS, runRoleRoulette } from "@/app/_domains/lol/roleRoulette"
import type { RoleKey, RouletteResult } from "@/app/_domains/lol/roleRoulette"
import type { RoleOrFill } from "../_types"
import { buildFrames, loadNamesFromStorage, loadSelectionsFromStorage, loadExcludedFromStorage, saveNamesToStorage, saveSelectionsToStorage, saveExcludedToStorage } from "../_utils"
import { RoleButton } from "./RoleButton"
import { AnimationDisplay } from "./AnimationDisplay"
import { ResultDisplay } from "./ResultDisplay"

const ALL_ROLES: RoleOrFill[] = [...ROLE_KEYS, "FILL"]
const MIN_ROWS = 5

export function RoleRouletteV2() {
  const [nameRows, setNameRows] = useState<string[]>(Array.from({ length: MIN_ROWS }, () => ""))
  const [roleSelections, setRoleSelections] = useState<Record<string, Set<RoleOrFill>>>({})
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set())
  const [result, setResult] = useState<RouletteResult | null>(null)
  const [animDisplayNames, setAnimDisplayNames] = useState<Record<RoleKey, string> | null>(null)
  const [lockedRoles, setLockedRoles] = useState<Set<RoleKey>>(new Set())
  const [isAnimating, setIsAnimating] = useState(false)
  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const names = nameRows.map((n) => n.trim()).filter((n) => n.length > 0)
  const activeNames = nameRows
    .map((n, i) => ({ name: n.trim(), i }))
    .filter(({ name, i }) => name.length > 0 && !excludedRows.has(i))
    .map(({ name }) => name)
  const duplicateNames = names.filter((name, i) => names.indexOf(name) !== i)

  useEffect(() => {
    void Promise.resolve().then(() => {
      const saved = loadNamesFromStorage()
      const rows = [...saved]
      while (rows.length < MIN_ROWS) rows.push("")
      if (rows.length > 0 && rows[rows.length - 1].trim() !== "") rows.push("")
      setNameRows(rows)
      setRoleSelections(loadSelectionsFromStorage())
      setExcludedRows(loadExcludedFromStorage())
    })
  }, [])

  const toggleExclude = (index: number) => {
    setExcludedRows((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      saveExcludedToStorage(next)
      return next
    })
    setResult(null)
  }

  const clearTimeouts = () => {
    for (const id of timeoutIdsRef.current) clearTimeout(id)
    timeoutIdsRef.current = []
  }

  const buildNextSelections = (updatedRows: string[], prev: Record<string, Set<RoleOrFill>>) => {
    const newNames = new Set(updatedRows.map((n) => n.trim()).filter((n) => n.length > 0))
    const next: Record<string, Set<RoleOrFill>> = {}
    for (const name of newNames) {
      next[name] = prev[name] ?? new Set()
    }
    return next
  }

  const handleRowChange = (index: number, value: string) => {
    setResult(null)
    const updatedRows = nameRows.map((n, i) => (i === index ? value : n))
    if (index === nameRows.length - 1 && value.trim().length > 0) {
      updatedRows.push("")
    }
    while (updatedRows.length > MIN_ROWS) {
      const lastIdx = updatedRows.length - 1
      if (updatedRows[lastIdx].trim() === "" && updatedRows[lastIdx - 1]?.trim() === "") {
        updatedRows.pop()
      } else {
        break
      }
    }
    const nextSelections = buildNextSelections(updatedRows, roleSelections)
    setNameRows(updatedRows)
    setRoleSelections(nextSelections)
    saveNamesToStorage(updatedRows.map((n) => n.trim()).filter((n) => n.length > 0))
    saveSelectionsToStorage(nextSelections)
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault()
      inputRefs.current[index + 1]?.focus()
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text")
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    if (lines.length <= 1) return

    e.preventDefault()
    const updatedRows = [...nameRows]
    lines.forEach((line, i) => {
      const targetIndex = index + i
      if (targetIndex < updatedRows.length) {
        updatedRows[targetIndex] = line
      } else {
        updatedRows.push(line)
      }
    })
    if (updatedRows[updatedRows.length - 1].trim() !== "") {
      updatedRows.push("")
    }
    const nextSelections = buildNextSelections(updatedRows, roleSelections)
    setNameRows(updatedRows)
    setRoleSelections(nextSelections)
    setResult(null)
    saveNamesToStorage(updatedRows.map((n) => n.trim()).filter((n) => n.length > 0))
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
    for (const name of activeNames) {
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
    const participants = [...activeNames]
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
      <div className="mb-6 overflow-x-auto">
        <table className="text-sm border-collapse">
          <thead className="p-2"></thead>
          <tbody>
            {nameRows.map((rowName, index) => {
              const isExcluded = excludedRows.has(index)
              const hasName = rowName.trim().length > 0
              return (
                <tr key={index} className={`border-b border-zinc-700 ${isExcluded ? "opacity-40" : ""}`}>
                  <td className="min-w-8">
                    <button
                      onClick={() => toggleExclude(index)}
                      disabled={!hasName}
                      className="block rounded p-1 transition-colors cursor-pointer hover:bg-zinc-700 disabled:cursor-default disabled:pointer-events-none"
                      aria-label="休憩"
                      aria-pressed={isExcluded}
                    >
                      {isExcluded || !hasName ? (
                        <Image src="/util/zzz-svgrepo-com.svg" alt="rest" width={24} height={24} className="transition-opacity invert opacity-50" />
                      ) : (
                        <Image src="/util/person_raised_hand_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg" alt="参加" width={24} height={24} className="transition-opacity opacity-100" />
                      )}
                    </button>
                  </td>
                  <td className="py-1 md:pr-4 pr-2 min-w-40">
                    <input
                      ref={(el) => {
                        inputRefs.current[index] = el
                      }}
                      type="text"
                      value={rowName}
                      onChange={(e) => handleRowChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={(e) => handlePaste(index, e)}
                      placeholder={`player${index + 1}`}
                      className="w-full bg-zinc-800 border border-zinc-600 text-white text-lg px-2 py-1.5 rounded focus:outline-none focus:border-zinc-400 placeholder-zinc-600"
                    />
                  </td>
                  {ALL_ROLES.map((role) => {
                    const name = rowName.trim()
                    const selected = name ? (roleSelections[name]?.has(role) ?? false) : false
                    return (
                      <td key={role} className={`text-center py-1 md:px-2 px-0.5 ${role === "FILL" ? "bg-zinc-800" : ""}`}>
                        <RoleButton name={name} role={role} selected={selected} onClick={() => toggleRole(name, role)} />
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <button
        className="bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2 rounded mb-6"
        onClick={handleStart}
        disabled={activeNames.length < 5 || duplicateNames.length > 0 || isAnimating}
      >
        {isAnimating ? "抽選中..." : "抽選開始"}
      </button>
      {duplicateNames.length > 0 && <span className="ml-3 text-red-400 text-sm">※ 名前が重複しています: {[...new Set(duplicateNames)].join(", ")}</span>}
      {duplicateNames.length === 0 && activeNames.length > 0 && activeNames.length < 5 && <span className="ml-3 text-zinc-400 text-sm">※ 5人以上必要です（現在 {activeNames.length} 人）</span>}

      <div className="">
        {isAnimating && animDisplayNames && <AnimationDisplay animDisplayNames={animDisplayNames} lockedRoles={lockedRoles} />}
        {result && <ResultDisplay result={result} />}
      </div>
    </>
  )
}
