"use client"

/** Discord magic-link ログインを案内するモーダル（書き込み時に未認証なら表示） */
export function LoginModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="w-[min(92vw,420px)] rounded-xl bg-white p-6 text-slate-800 shadow-xl">
      <h2 className="text-base font-bold text-slate-900">ログインが必要です</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        予定を編集するには Discord でのログインが必要です。以下の手順でログインしてください。
      </p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
        <li>
          Discord で <code className="rounded bg-slate-100 px-1 py-0.5 text-[13px]">/team-schedule-login</code> を実行
        </li>
        <li>bot から本人にだけ届くログイン用リンクをクリック</li>
        <li>このページに戻ると、予定を編集できるようになります</li>
      </ol>
      <p className="mt-3 text-xs text-slate-400">※ 一度ログインすれば、以降は自動でログイン状態が維持されます。</p>
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          閉じる
        </button>
      </div>
    </div>
  )
}
