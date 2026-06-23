"use client"

/**
 * チーム参加数の上限に達したユーザー向けの案内文（アップセル含む）。
 * モーダル（ボタン押下時）と設定モーダルの「新規作成」タブで同じ文言を使うため共有する。
 */
export const CREATE_TEAM_RESTRICTED_MESSAGE = "1人が参加できるチームは2つまでです。\n上限に達しているため、新しいチームの作成・参加はできません。\n※今後、有料プランでの上限解放を予定しています。"

type CreateTeamRestrictedModalProps = {
  onClose: () => void
}

/** ログイン済みだがチーム参加数の上限に達したユーザーが「チームを作成」を押したときの案内モーダル */
export function CreateTeamRestrictedModal({ onClose }: CreateTeamRestrictedModalProps) {
  return (
    <div className="w-[min(92vw,420px)] rounded-xl border border-zinc-700 bg-zinc-900 p-6 text-zinc-100 shadow-xl">
      <h2 className="text-base font-bold text-zinc-100">チーム参加上限について</h2>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-300">{CREATE_TEAM_RESTRICTED_MESSAGE}</p>
      <div className="mt-5 flex justify-end">
        <button type="button" onClick={onClose} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          閉じる
        </button>
      </div>
    </div>
  )
}
