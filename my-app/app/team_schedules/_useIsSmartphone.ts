"use client"

import { useSyncExternalStore } from "react"

/**
 * 画面幅が「スマホ」（< 640px = Tailwind sm 未満）かどうかを購読するフック。
 *
 * useState + resize listener だと SSR とのハイドレーション差異が出るため、
 * matchMedia を useSyncExternalStore で購読する。
 * - getServerSnapshot は false（サーバーでは画面幅が不明なので非スマホ扱い→表）。
 *   マウント後に matchMedia の実値で再評価される。
 */

const QUERY = "(max-width: 639.98px)"

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches
}

function getServerSnapshot(): boolean {
  return false
}

/** 画面幅が < 640px なら true */
export function useIsSmartphone(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
