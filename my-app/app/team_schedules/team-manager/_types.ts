/**
 * チーム管理画面（#97）の UI ステート専用の型。
 * ドメインのデータ構造（TeamManagerView 等）は domains 側に置き、ここは画面固有の状態のみ。
 */

/** メンバー一覧テーブルのソート対象列（ステータス・招待者・Discord ID はソート対象外） */
export type SortKey = "name" | "role" | "joinedAt"

/** ソート方向 */
export type SortDir = "asc" | "desc"

/** 現在のソート状態（列 + 方向） */
export type SortState = { key: SortKey; dir: SortDir }
