"use client"

import { ROLE_KEYS, ROLE_LABELS } from "@/app/_domains/lol/roleRoulette"
import type { RouletteResult } from "@/app/_domains/lol/roleRoulette"

type Props = {
  result: RouletteResult
}

export function ResultDisplay({ result }: Props) {
  return (
    <div className={`p-4 rounded border ${result.ok ? "border-green-600 bg-green-900/30" : "border-red-600 bg-red-900/30"}`}>
      {result.ok ? (
        <>
          <p className="font-semibold mb-2">抽選結果</p>
          <ul className="space-y-1">
            {ROLE_KEYS.map((role) => (
              <li key={role}>
                <span className="inline-block w-12 font-semibold">{ROLE_LABELS[role]}</span>
                {result.assignment[role]}
              </li>
            ))}
            {result.rest.length > 0 && (
              <li>
                <span className="inline-block w-12 font-semibold text-zinc-400">休憩</span>
                <span className="text-zinc-400">{result.rest.join(", ")}</span>
              </li>
            )}
          </ul>
        </>
      ) : (
        <p className="text-red-400">{result.error}</p>
      )}
    </div>
  )
}
