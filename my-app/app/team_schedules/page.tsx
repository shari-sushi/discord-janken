"use client"

import { Suspense } from "react"
import { TeamSchedulesPage } from "./_components/TeamSchedulesPage"

export default function TeamSchedulesPageWrapper() {
  return (
    <Suspense>
      <TeamSchedulesPage />
    </Suspense>
  )
}
