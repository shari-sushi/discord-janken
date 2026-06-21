/** 利用停止状態のバッジ表示（停止中=赤 / 通常=控えめ） */
export function SuspendBadge({ suspended }: { suspended: boolean }) {
  if (!suspended) return <span className="text-xs text-zinc-500">通常</span>
  return <span className="rounded bg-rose-900/60 px-1.5 py-0.5 text-xs font-medium text-rose-300">利用停止中</span>
}
