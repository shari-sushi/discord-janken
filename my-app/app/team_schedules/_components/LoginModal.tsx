"use client"

/** Discord magic-link ログインを案内するモーダル（書き込み時に未認証なら表示） */
export function LoginModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="w-[min(92vw,420px)] rounded-xl border border-zinc-700 bg-zinc-900 p-6 text-zinc-100 shadow-xl">
      <h2 className="text-base font-bold text-zinc-100">ログインが必要です</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-300">
        予定を編集するには Discord でのログインが必要です。以下の手順でログインしてください。
      </p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-zinc-200">
        <li>
          Discord で <code className="rounded bg-zinc-800 px-1 py-0.5 text-[13px]">/team-schedule-login</code> を実行
        </li>
        <li>bot から本人にだけ届くログイン用リンクをクリック</li>
        <li>このページに戻ると、予定を編集できるようになります</li>
      </ol>
      <p className="mt-3 text-xs text-zinc-400">※ 一度ログインすれば、以降は自動でログイン状態が維持されます。</p>

      <div className="mt-4 rounded-lg border border-zinc-700 bg-zinc-800/60 p-3 text-xs leading-relaxed text-zinc-300">
        <p>
          サーバーに bot が居ない場合は、以下のリンクから bot を導入してから{" "}
          <code className="rounded bg-zinc-800 px-1 py-0.5">/team-schedule-login</code> を実行してください。
        </p>
        <a
          href="https://discord.com/oauth2/authorize?client_id=1465767639484858450&scope=bot+applications.commands&permissions=84992"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block break-all text-indigo-400 underline hover:text-indigo-300"
        >
          bot をサーバーに追加する
        </a>
      </div>
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-600"
        >
          閉じる
        </button>
      </div>
    </div>
  )
}
