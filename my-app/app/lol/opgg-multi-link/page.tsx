"use client"

import { Suspense } from "react"
import { OpggMultiLinkPage } from "./_components/OpggMultiLinkPage"

export default function OpggMultiLinkPageWrapper() {
  return (
    <Suspense>
      <OpggMultiLinkPage />
    </Suspense>
  )
}
