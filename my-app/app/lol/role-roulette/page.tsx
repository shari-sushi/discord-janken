"use client"

import { Suspense } from "react"
import { RoleRoulettePage } from "./_components/RoleRoulettePage"

export default function RoleRoulettePageWrapper() {
  return (
    <Suspense>
      <RoleRoulettePage />
    </Suspense>
  )
}
