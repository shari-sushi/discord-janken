import Link from "next/link"

export default function LolIndexPage() {
  return (
    <main className="p-8 font-sans">
      <ul className="flex flex-col gap-3 pl-4 list-none">
        <li>
          <Link href="/lol/role-roulette" className="hover:underline hover:text-zinc-400 text-zinc-100">
            ロールルーレット
          </Link>
        </li>
        <li>
          <Link href="/lol/all-ranked" className="hover:underline hover:text-zinc-400 text-zinc-100">
            全ランク確認
          </Link>
        </li>
        <li>
          <Link href="/lol/opgg-multi-link" className="hover:underline hover:text-zinc-400 text-zinc-100">
            op.gg マルチサーチリンク生成
          </Link>
        </li>
        <li>
          <Link href="/team_schedules" className="hover:underline hover:text-zinc-400 text-zinc-100">
            スクリム調整
          </Link>
        </li>
      </ul>
    </main>
  )
}
