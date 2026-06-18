"use client"

/**
 * チーム新規作成権限がないユーザー向けの案内文。
 * モーダル（ボタン押下時）と設定モーダルの「新規作成」タブで同じ文言を使うため共有する。
 */
export const CREATE_TEAM_RESTRICTED_MESSAGE = "現在プレリリース期間によりチーム新規作成機能の権限を絞っています。\nチーム作成希望の方は、開発者にコンタクトしてください。（大抵の場合許可が出ます。）"

type CreateTeamRestrictedModalProps = {
  onClose: () => void
}

/** ログイン済みだがチーム作成権限が無いユーザーが「チームを作成」を押したときの案内モーダル */
export function CreateTeamRestrictedModal({ onClose }: CreateTeamRestrictedModalProps) {
  return (
    <div className="w-[min(92vw,420px)] rounded-xl border border-zinc-700 bg-zinc-900 p-6 text-zinc-100 shadow-xl">
      <h2 className="text-base font-bold text-zinc-100">チーム新規作成について</h2>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-300">{CREATE_TEAM_RESTRICTED_MESSAGE}</p>
      <div className="mt-5 flex justify-end">
        <button type="button" onClick={onClose} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          閉じる
        </button>
      </div>
    </div>
  )
}
