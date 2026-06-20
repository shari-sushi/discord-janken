"use client"

import { useState } from "react"
import Link from "next/link"
import { useOverlay } from "@/app/_client/lib/modal/ModalContext"
import { DiscordWebhookOverlay } from "@/app/lol/opgg-multi-link/_components/DiscordWebhookOverlay"

const NAV_LINKS = [
  { href: "/lol", label: "トップ" },
  { href: "/lol/role-roulette", label: "ロールルーレット" },
  { href: "/lol/opgg-multi-link", label: "LTK向け: op.gg マルチサーチリンク生成" },
  { href: "/lol/all-ranked", label: "ランク確認" },
  { href: "/team_schedules", label: "チーム活動 スケジュール調整" },
]

/**
 * ログイン中ユーザー名を右側に表示したいページから渡す。
 * - userName があればその名前を表示
 * - userName が無く onLogin が渡されていれば「ログイン」ボタンを表示
 */
type LolHeaderProps = {
  userName?: string | null
  onLogin?: () => void
}

export default function LolHeader({ userName, onLogin }: LolHeaderProps = {}) {
  const [isOpen, setIsOpen] = useState(false)
  const { open } = useOverlay()

  const handleWebhookSetting = () => {
    setIsOpen(false)
    open(<DiscordWebhookOverlay onConfirm={() => {}} />)
  }

  return (
    <>
      {/* バックドロップ：クリックでメニューを閉じる */}
      <div
        className={`fixed inset-0 z-30 bg-zinc-900/70 transition-opacity duration-300 ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* ドロワーメニュー（左からスライド） */}
      <div
        className={`fixed top-0 left-0 z-40 h-svh w-full md:w-[40%] bg-zinc-900 border-r border-zinc-700 transform transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="p-6 pt-16 flex flex-col gap-8">
          {/* リンクセクション */}
          <div>
            <p className="text-xs text-zinc-500 font-semibold tracking-widest mb-3">〇 リンク</p>
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map(({ href, label }) => (
                <Link key={href} href={href} className="text-zinc-100 hover:text-zinc-400 py-2 px-2 rounded hover:bg-zinc-800 transition-colors" onClick={() => setIsOpen(false)}>
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          {/* 設定セクション */}
          <div>
            <p className="text-xs text-zinc-500 font-semibold tracking-widest mb-3">〇 設定</p>
            <div className="flex flex-col gap-1">
              <button onClick={handleWebhookSetting} className="text-left text-zinc-100 hover:text-zinc-400 py-2 px-2 rounded hover:bg-zinc-800 transition-colors cursor-pointer">
                Discord Webhook
              </button>
            </div>
          </div>
        </div>
      </div>

      <header className="relative z-50 bg-zinc-900 text-zinc-100 border-b border-zinc-700">
        {/* スマホ（md未満）はヘッダーを細くして縦スペースを節約する。md以上は従来サイズ（#155） */}
        <div className="flex items-center gap-3 px-4 py-2 md:gap-4 md:py-3">
          {/* ハンバーガーボタン（左上）。スマホは一回り小さく、md以上は従来サイズ */}
          <button
            onClick={() => setIsOpen((prev) => !prev)}
            className="flex flex-col justify-center gap-1.5 w-7 h-7 md:w-8 md:h-8 focus:outline-none hover:opacity-70 cursor-pointer shrink-0"
            aria-label="メニューを開閉する"
          >
            <span className={`block h-0.5 w-full bg-zinc-100 transition-transform duration-200 ${isOpen ? "translate-y-2 rotate-45" : ""}`} />
            <span className={`block h-0.5 w-full bg-zinc-100 transition-opacity duration-200 ${isOpen ? "opacity-0" : ""}`} />
            <span className={`block h-0.5 w-full bg-zinc-100 transition-transform duration-200 ${isOpen ? "-translate-y-2 -rotate-45" : ""}`} />
          </button>

          <Link href="/lol" className="font-bold text-base md:text-lg hover:text-zinc-300 hover:opacity-70">
            LoL ツール
          </Link>

          {/* 右端: ログイン中はユーザー名、未ログイン時はログインボタン */}
          {userName ? (
            <span className="ml-auto flex items-center gap-1.5 truncate text-sm text-zinc-300" title={userName}>
              <span aria-hidden="true">👤</span>
              <span className="truncate">{userName}</span>
            </span>
          ) : (
            onLogin && (
              <button
                type="button"
                onClick={onLogin}
                className="ml-auto rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
              >
                ログイン
              </button>
            )
          )}
        </div>
      </header>
    </>
  )
}
