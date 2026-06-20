/**
 * /team_schedules のビューポート枠。
 * md以下（lg未満）はヘッダー＋body を画面内に収め、カレンダー（グリッド）だけスクロールさせる。
 * lg以上は通常のページスクロール。
 * ヘッダー（LolHeader）の描画とログイン状態は page 側に残す（ログイン表示は team_schedules 固有のため、
 * 汎用の LolHeader には rightSlot で下から渡す。App Router では layout から page の状態を参照できないため）。
 */
export default function TeamSchedulesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-zinc-950 text-zinc-100 lg:block lg:h-auto lg:min-h-screen lg:overflow-visible">
      {children}
    </div>
  )
}
