"use client"

import { useSyncExternalStore } from "react"
import type { ComparisonSelection } from "./_types"
import { SELECTION_STORAGE_KEY, loadSelection, saveSelection } from "./_utils"

/**
 * 比較チーム選択（自チーム + 相手チーム）を localStorage に永続化する外部ストア。
 *
 * useState + useEffect で復元すると SSR とのハイドレーション差異が出る／
 * effect 内 setState が ESLint(react-hooks/set-state-in-effect) に弾かれるため、
 * React 公式が外部ストア連携に推奨する useSyncExternalStore で実装する。
 * - getSnapshot: クライアントの現在値（初回に localStorage から復元）
 * - getServerSnapshot: SSR・ハイドレーション時は空（サーバーには localStorage が無い）
 *
 * タブ間同期: storage イベント（他タブでの localStorage 変更時のみ発火）を購読し、
 * 別タブで選択が変わったらこのタブにも反映する。
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

// 他タブでの localStorage 変更を取り込む。storage イベントは変更を起こしたタブには発火しないため、
// このハンドラが呼ばれる＝別タブが選択を更新したとき。cache を読み直して購読者に通知する。
function onStorage(e: StorageEvent): void {
  // e.key === null は localStorage.clear() のケース。自分のキー or clear のときだけ反応する。
  if (e.key !== null && e.key !== SELECTION_STORAGE_KEY) return
  cache = loadSelection() ?? EMPTY
  listeners.forEach((l) => l())
}

// storage リスナーは1つだけ張る（購読者数で参照カウント）。
// addEventListener はクライアント専用なので、SSRで実行されない subscribe 内で登録する。
let storageListenerCount = 0

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  if (storageListenerCount === 0) window.addEventListener("storage", onStorage)
  storageListenerCount++
  return () => {
    listeners.delete(onChange)
    storageListenerCount--
    if (storageListenerCount === 0) window.removeEventListener("storage", onStorage)
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
