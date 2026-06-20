"use client"

import { InlineStatusIcon } from "../_icons/StatusIcon"

/**
 * スケジュール画面の使い方説明文（md以上はページ末に直接表示、md未満はヒントボタン→モーダルで表示）。
 * ○△× はセルと同じ SVG アイコンで表示する。container 側で whitespace-pre-line を指定すること。
 */
export function ScheduleHelpContent({ className, prefix }: { className?: string; prefix?: string }) {
  const ok = <InlineStatusIcon status="ok" />
  const maybe = <InlineStatusIcon status="maybe" />
  const ng = <InlineStatusIcon status="ng" />
  return (
    <p className={className}>
      {prefix}
      自分の日付をタップすると 未回答→{ok}→{maybe}→{ng} が切り替わります。{"\n\n"}
      【チーム単位管理】管理者が1列でチーム全体の予定をまとめて入力します。{ok}が活動可能・{ng}が詰みの日です。{"\n\n"}
      【メンバー管理】メンバーごとに回答し、{ok}数が必要人数以上かつ相手が空いている日が「成立」。{ng}が増えて必要人数に届かない確定の日は行を薄く表示し、相手の不可セルも薄く表示します。時間は自由記入のため、{ok}数は時間の重なりまでは見ていません。
    </p>
  )
}

type ScheduleHelpModalProps = {
  onClose: () => void
}

/** 使い方説明を表示するモーダル（md未満でヒントボタンから開く） */
export function ScheduleHelpModal({ onClose }: ScheduleHelpModalProps) {
  return (
    <div className="w-[min(92vw,460px)] rounded-xl border border-zinc-700 bg-zinc-900 p-6 text-zinc-100 shadow-xl">
      <h2 className="text-base font-bold text-zinc-100">使い方</h2>
      <ScheduleHelpContent className="mt-3 whitespace-pre-line text-sm leading-relaxed text-zinc-300" />

      <div className="mt-5 flex justify-end">
        <button type="button" onClick={onClose} className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-600">
          閉じる
        </button>
      </div>
    </div>
  )
}
