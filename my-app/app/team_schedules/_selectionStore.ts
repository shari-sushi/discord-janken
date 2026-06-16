"use client"

import { useSyncExternalStore } from "react"
import type { ComparisonSelection } from "./_types"
import { loadSelection, saveSelection } from "./_utils"

/**
 * 比較チーム選択（自チーム + 相手チーム）を localStorage に永続化する外部ストア。
 *
 * useState + useEffect で復元すると SSR とのハイドレーション差異が出る／
 * effect 内 setState が ESLint(react-hooks/set-state-in-effect) に弾かれるため、
 * React 公式が外部ストア連携に推奨する useSyncExternalStore で実装する。
 * - getSnapshot: クライアントの現在値（初回に localStorage から復元）
 * - getServerSnapshot: SSR・ハイドレーション時は空（サーバーには localStorage が無い）
 */

const EMPTY: ComparisonSelection = { ownTeamId: null, opponentTeamIds: [] }

// 同一参照を返さないと useSyncExternalStore が無限再レンダリングするためキャッシュする
let cache: ComparisonSelection | null = null
const listeners = new Set<() => void>()

function getSnapshot(): ComparisonSelection {
  if (cache === null) cache = loadSelection() ?? EMPTY
  return cache
}

function getServerSnapshot(): ComparisonSelection {
  return EMPTY
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

/** 選択を更新して localStorage に保存し、購読者へ通知する。値・更新関数のどちらも受け付ける。 */
export function setStoredSelection(next: ComparisonSelection | ((prev: ComparisonSelection) => ComparisonSelection)): void {
  const value = typeof next === "function" ? next(getSnapshot()) : next
  cache = value
  saveSelection(value)
  listeners.forEach((l) => l())
}

/** 永続化された比較チーム選択を購読する */
export function useStoredSelection(): ComparisonSelection {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
