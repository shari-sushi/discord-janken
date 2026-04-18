"use client"
import { Suspense, useState, useRef, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Image from "next/image"
import { ROLE_KEYS, ROLE_LABELS, runRoleRoulette } from "@/app/domains/lol/roleRoulette"
import type { RoleKey, RouletteResult } from "@/app/domains/lol/roleRoulette"
import { TabSelector } from "@/app/_client/components/TabSelector"

// ---- 共通定数・型 ----

type RoleOrFill = RoleKey | "FILL"
const ALL_ROLES: RoleOrFill[] = [...ROLE_KEYS, "FILL"]
const ROLE_DISPLAY: Record<RoleOrFill, string> = { ...ROLE_LABELS, FILL: "FILL" }

const ROLE_ICON: Record<RoleOrFill, string> = {
  TOP: "/lol/positions/position-top.svg",
  JG: "/lol/positions/position-jungle.svg",
  MID: "/lol/positions/position-middle.svg",
  ADC: "/lol/positions/position-bottom.svg",
  SUP: "/lol/positions/position-utility.svg",
  FILL: "/lol/positions/icon-position-fill.png",
}

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

// ---- 共通UI部品 ----

function RoleButton({ name, role, selected, onClick }: { name: string; role: RoleOrFill; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!name}
      className="mx-auto rounded p-0.5 transition-opacity cursor-pointer hover:bg-zinc-700 disabled:cursor-default disabled:pointer-events-none"
      aria-label={ROLE_DISPLAY[role]}
      aria-pressed={selected}
    >
      <Image src={ROLE_ICON[role]} alt={ROLE_DISPLAY[role]} width={28} height={28} className={`min-w-6 transition-opacity my-1 md:mx-2 ${selected ? "" : "opacity-30"}`} />
    </button>
  )
}

function AnimationDisplay({ animDisplayNames, lockedRoles }: { animDisplayNames: Record<RoleKey, string>; lockedRoles: Set<RoleKey> }) {
  return (
    <div className="p-4 rounded border border-blue-600 bg-blue-900/20">
      <p className="font-semibold mb-3 text-blue-300">抽選中...</p>
      <ul className="space-y-2">
        {ROLE_KEYS.map((role) => (
          <li key={role} className="flex items-center gap-3">
            <span className="inline-block w-12 font-semibold text-zinc-400">{ROLE_LABELS[role]}</span>
            <span className={`font-mono text-lg min-w-24 transition-colors duration-150 ${lockedRoles.has(role) ? "text-green-400 font-bold" : "text-zinc-500"}`}>{animDisplayNames[role]}</span>
            {lockedRoles.has(role) && <span className="text-green-500 text-sm">✓</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ResultDisplay({ result }: { result: RouletteResult }) {
  return (
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
  )
}

// ---- V1: textareaバージョン ----

function parseNames(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

// ---- 共通 localStorage ----

const LS_NAMES_KEY = "lol-rr-names"
const LS_SELECTIONS_KEY = "lol-rr-selections"
const LS_EXCLUDED_KEY = "lol-rr-excluded"

function loadNamesFromStorage(): string[] {
  try {
    const saved = localStorage.getItem(LS_NAMES_KEY)
    if (saved) return JSON.parse(saved) as string[]
  } catch {
    console.error("入力情報のlocalStorageへの保存に失敗しました")
  }
  return []
}

function loadSelectionsFromStorage(): Record<string, Set<RoleOrFill>> {
  try {
    const saved = localStorage.getItem(LS_SELECTIONS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Record<string, RoleOrFill[]>
      return Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, new Set(v)]))
    }
  } catch {
    console.error("入力情報のlocalStorageからの読み込みに失敗しました")
  }
  return {}
}

function saveNamesToStorage(names: string[]): void {
  localStorage.setItem(LS_NAMES_KEY, JSON.stringify(names))
}

function saveSelectionsToStorage(selections: Record<string, Set<RoleOrFill>>): void {
  const serializable = Object.fromEntries(Object.entries(selections).map(([k, v]) => [k, [...v]]))
  localStorage.setItem(LS_SELECTIONS_KEY, JSON.stringify(serializable))
}

function loadExcludedFromStorage(): Set<number> {
  try {
    const saved = localStorage.getItem(LS_EXCLUDED_KEY)
    if (saved) return new Set<number>(JSON.parse(saved) as number[])
  } catch {
    console.error("休み情報のlocalStorageからの読み込みに失敗しました")
  }
  return new Set()
}

function saveExcludedToStorage(excluded: Set<number>): void {
  localStorage.setItem(LS_EXCLUDED_KEY, JSON.stringify([...excluded]))
}

function RoleRouletteV1() {
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

// ---- V2: 個別inputバージョン（Enter/↓↑ナビ・複数行ペースト対応） ----

const MIN_ROWS = 5

function RoleRouletteV2() {
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

// ---- ルーター（セグメントコントロールで分岐） ----

const VERSIONS = [
  { id: "1", label: "textarea版" },
  { id: "2", label: "input版" },
] as const
type VersionId = (typeof VERSIONS)[number]["id"]

function RoleRouletteRouter() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [version, setVersion] = useState<VersionId>(() => {
    const v = searchParams.get("v")
    if (v === "1" || v === "2") return v
    return "2"
  })

  const handleVersionChange = (v: VersionId) => {
    setVersion(v)
    router.replace(`?v=${v}`, { scroll: false })
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">ロールルーレット</h1>
        <TabSelector tabs={[...VERSIONS]} selected={version} onChange={handleVersionChange} />
      </div>
      {version === "1" && <RoleRouletteV1 />}
      {version === "2" && <RoleRouletteV2 />}
    </div>
  )
}

export default function RoleRoulettePage() {
  return (
    <Suspense>
      <RoleRouletteRouter />
    </Suspense>
  )
}
