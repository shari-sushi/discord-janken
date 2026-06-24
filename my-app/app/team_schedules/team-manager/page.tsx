"use client"

import { Suspense } from "react"
import { TeamManagerPage } from "./_components/TeamManagerPage"

/**
 * チーム管理画面（#97）のエントリーポイント。
 * useSearchParams（?teamId=）を使うため Suspense でラップする（薄いラッパーのみ）。
 */
export default function TeamManagerPageWrapper() {
  return (
    <Suspense>
      <TeamManagerPage />
    </Suspense>
  )
}
