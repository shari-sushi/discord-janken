"use client"

import { useState, useRef, useEffect, type ReactNode } from "react"

export function InfoPopup({ message, children }: { message: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  return (
    <div className="relative inline-block" ref={ref} onClick={() => setOpen((v) => !v)}>
      {children}
      {open && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-60 bg-zinc-800 border border-zinc-600 rounded p-2 text-xs text-zinc-300 z-10 shadow-lg">
          {message}
          {/* 吹き出し三角 */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-600" />
        </div>
      )}
    </div>
  )
}
