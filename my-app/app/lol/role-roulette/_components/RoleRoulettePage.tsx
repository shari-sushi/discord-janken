"use client"

import { useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { TabSelector } from "@/app/_client/components/TabSelector"
import { VERSIONS } from "../_types"
import type { VersionId } from "../_types"
import { RoleRouletteV1 } from "./RoleRouletteV1"
import { RoleRouletteV2 } from "./RoleRouletteV2"

export function RoleRoulettePage() {
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
