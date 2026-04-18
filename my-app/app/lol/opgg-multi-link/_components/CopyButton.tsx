"use client"

import { useState, useCallback } from "react"

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handle = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [text])
  return (
    <button onClick={handle} className="shrink-0 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-3 py-1 rounded">
      {copied ? "コピーしました" : "コピー"}
    </button>
  )
}
