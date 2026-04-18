"use client"

import { ROLE_KEYS, ROLE_LABELS } from "@/app/_domains/lol/roleRoulette"
import type { RoleKey } from "@/app/_domains/lol/roleRoulette"

type Props = {
  animDisplayNames: Record<RoleKey, string>
  lockedRoles: Set<RoleKey>
}

export function AnimationDisplay({ animDisplayNames, lockedRoles }: Props) {
  return (
    <div className="p-4 rounded border border-blue-600 bg-blue-900/20">
      <p className="font-semibold mb-3 text-blue-300">抽選中...</p>
      <ul className="space-y-2">
        {ROLE_KEYS.map((role) => (
          <li key={role} className="flex items-center gap-3">
            <span className="inline-block w-12 font-semibold text-zinc-400">{ROLE_LABELS[role]}</span>
            <span className={`font-mono text-lg min-w-24 transition-colors duration-150 ${lockedRoles.has(role) ? "text-green-400 font-bold" : "text-zinc-500"}`}>{animDisplayNames[role]}</span>
            {lockedRoles.has(role) && <span className="text-green-500 text-sm">✓</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
