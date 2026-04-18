"use client"

import { useState, useCallback } from "react"
import { CopyIcon } from "@/app/_client/components/CopyIcon"

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handle = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [text])
  return (
    <div className="relative inline-flex">
      <button onClick={handle} className="shrink-0 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-3 py-1 rounded">
        <CopyIcon />
      </button>
      {copied && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap">
          コピーしました！
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
        </div>
      )}
    </div>
  )
}
