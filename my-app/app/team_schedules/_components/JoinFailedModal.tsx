"use client"

type JoinFailedModalProps = {
  /** 表示するメッセージ（参加 API の失敗理由。上限到達時はバックエンドの上限＋アップセル文言が入る） */
  message: string
  onClose: () => void
}

/** 招待リンクからの参加が失敗したとき（上限到達・失効トークン等）に理由を知らせる軽量モーダル */
export function JoinFailedModal({ message, onClose }: JoinFailedModalProps) {
  return (
    <div className="w-[min(92vw,420px)] rounded-xl border border-zinc-700 bg-zinc-900 p-6 text-zinc-100 shadow-xl">
      <h2 className="text-base font-bold text-zinc-100">チームに参加できませんでした</h2>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-300">{message}</p>
      <div className="mt-5 flex justify-end">
        <button type="button" onClick={onClose} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          閉じる
        </button>
      </div>
    </div>
  )
}
