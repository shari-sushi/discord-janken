"use client"

import { useState } from "react"
import Link from "next/link"

const NAV_LINKS = [
  { href: "/lol", label: "トップ" },
  { href: "/lol/role-roulette", label: "ロールルーレット" },
  { href: "/lol/all-ranked", label: "全ランク確認" },
]

export default function LolHeader() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <header className="relative z-20 bg-zinc-900 text-zinc-100 border-b border-zinc-700">
        <div className="flex items-center justify-between px-6 py-3">
          <Link href="/lol" className="font-bold text-lg hover:text-zinc-300 hover-opacity-70">
            LoL ツール
          </Link>
          <button onClick={() => setIsOpen((prev) => !prev)} className="flex flex-col justify-center gap-1.5 w-8 h-8 focus:outline-none hover:opacity-70 cursor-pointer" aria-label="メニューを開閉する">
            <span className={`block h-0.5 w-full bg-zinc-100 transition-transform duration-200 ${isOpen ? "translate-y-2 rotate-45" : ""}`} />
            <span className={`block h-0.5 w-full bg-zinc-100 transition-opacity duration-200 ${isOpen ? "opacity-0" : ""}`} />
            <span className={`block h-0.5 w-full bg-zinc-100 transition-transform duration-200 ${isOpen ? "-translate-y-2 -rotate-45" : ""}`} />
          </button>
        </div>

        {/* ドロワーメニュー：absolute で body にかぶせる */}
        {isOpen && (
          <nav className="absolute top-full left-0 w-full bg-zinc-900 border-b border-zinc-700 px-6 py-4 flex flex-col gap-3 z-20">
            {NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className="hover:underline hover:text-zinc-400 text-zinc-100" onClick={() => setIsOpen(false)}>
                {label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {/* オーバーレイ：クリックでメニューを閉じる */}
      {isOpen && <div className="fixed inset-0 z-10 bg-zinc-900/30" onClick={() => setIsOpen(false)} aria-hidden="true" />}
    </>
  )
}
