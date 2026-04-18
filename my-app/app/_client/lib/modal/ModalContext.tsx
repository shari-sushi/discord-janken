"use client"

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"

type OverlayContextValue = {
  open: (content: ReactNode) => void
  close: () => void
}

const OverlayContext = createContext<OverlayContextValue | null>(null)

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode | null>(null)

  const open = useCallback((c: ReactNode) => setContent(c), [])
  const close = useCallback(() => setContent(null), [])

  return (
    <OverlayContext.Provider value={{ open, close }}>
      {children}
      {content !== null && (
        <>
          {/* 全画面の半透明背景 */}
          <div className="w-full h-full fixed inset-0 z-40 bg-zinc-500/70" onClick={close} />
          {/* 手前に表示するコンテンツ */}
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto">{content}</div>
          </div>
        </>
      )}
    </OverlayContext.Provider>
  )
}

export function useOverlay(): OverlayContextValue {
  const ctx = useContext(OverlayContext)
  if (!ctx) throw new Error("useOverlay must be used within OverlayProvider")
  return ctx
}
