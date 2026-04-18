import type { RoleOrFill } from "./_types"

// アニメーションのフレームタイムスタンプを生成（指数的に遅くなる）
export function buildFrames(durationMs: number): number[] {
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

export function parseNames(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

// ---- localStorage ----

const LS_NAMES_KEY = "lol-rr-names"
const LS_SELECTIONS_KEY = "lol-rr-selections"
const LS_EXCLUDED_KEY = "lol-rr-excluded"

export function loadNamesFromStorage(): string[] {
  try {
    const saved = localStorage.getItem(LS_NAMES_KEY)
    if (saved) return JSON.parse(saved) as string[]
  } catch {
    console.error("入力情報のlocalStorageへの保存に失敗しました")
  }
  return []
}

export function loadSelectionsFromStorage(): Record<string, Set<RoleOrFill>> {
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

export function saveNamesToStorage(names: string[]): void {
  localStorage.setItem(LS_NAMES_KEY, JSON.stringify(names))
}

export function saveSelectionsToStorage(selections: Record<string, Set<RoleOrFill>>): void {
  const serializable = Object.fromEntries(Object.entries(selections).map(([k, v]) => [k, [...v]]))
  localStorage.setItem(LS_SELECTIONS_KEY, JSON.stringify(serializable))
}

export function loadExcludedFromStorage(): Set<number> {
  try {
    const saved = localStorage.getItem(LS_EXCLUDED_KEY)
    if (saved) return new Set<number>(JSON.parse(saved) as number[])
  } catch {
    console.error("休み情報のlocalStorageからの読み込みに失敗しました")
  }
  return new Set()
}

export function saveExcludedToStorage(excluded: Set<number>): void {
  localStorage.setItem(LS_EXCLUDED_KEY, JSON.stringify([...excluded]))
}
