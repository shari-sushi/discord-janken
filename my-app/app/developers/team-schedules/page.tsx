import { TeamSchedulesAdminPage } from "./_components/TeamSchedulesAdminPage"

/**
 * 開発者用 スクリム調整 管理ページ（#166）。
 * 認証は開発者ログイン（localStorage.sessionToken）を流用し、未ログインは /login へ。
 * エントリーは薄く保ち、状態管理・レイアウトは _components/TeamSchedulesAdminPage に委譲する。
 */
export default function Page() {
  return <TeamSchedulesAdminPage />
}
