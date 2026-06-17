"use client"

import { useSyncExternalStore } from "react"

/**
 * スケジュール表示モード（表 / カード）を localStorage に永続化する外部ストア。
 *
 * 設計は _selectionStore.ts と同じ（useSyncExternalStore でSSR/hydration安全・タブ間同期）。
 * ただし null を「明示的な未選択」という正当値に使うため、キャッシュ番兵だけ undefined（未読込）と分けている。
 * - 値は「ユーザーが明示的に選んだモード」。未選択は null（呼び出し側が画面幅に応じて既定値を決める）。
 * - getServerSnapshot は null（サーバーには localStorage が無い）。
 */

export type ViewMode = "table" | "card"

/** 表示モードを保存する localStorage キー */
export const VIEW_MODE_STORAGE_KEY = "ts_view_mode"

/** localStorage から表示モードを読み込む。未設定・不正値・localStorage不可なら null */
export function loadViewMode(): ViewMode | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY)
    return raw === "table" || raw === "card" ? raw : null
  } catch {
    return null
  }
}

/** 表示モードを localStorage に保存する（localStorage不可の環境では黙って諦める） */
export function saveViewMode(mode: ViewMode): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode)
  } catch {
    // プライベートモードや容量超過では永続化を諦める（機能自体は動作する）
  }
}

// getSnapshot のたびに localStorage を読み直さないよう、解決済みの値をキャッシュする（undefined = 未読込）。
// ViewMode は primitive なので _selectionStore（object 返却で参照安定が必須）と違い参照安定は不要だが、I/O 回避のため同じ形を採る。
let cache: ViewMode | null | undefined
const listeners = new Set<() => void>()

function getSnapshot(): ViewMode | null {
  if (cache === undefined) cache = loadViewMode()
  return cache
}

function getServerSnapshot(): ViewMode | null {
  return null
}

// 他タブでの localStorage 変更を取り込む（変更を起こしたタブには発火しない）
function onStorage(e: StorageEvent): void {
  if (e.key !== null && e.key !== VIEW_MODE_STORAGE_KEY) return
  cache = loadViewMode()
  listeners.forEach((l) => l())
}

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

/** 表示モードを更新して localStorage に保存し、購読者へ通知する */
export function setStoredViewMode(mode: ViewMode): void {
  cache = mode
  saveViewMode(mode)
  listeners.forEach((l) => l())
}

/** 永続化された表示モードを購読する（未選択は null） */
export function useStoredViewMode(): ViewMode | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
