/**
 * Discord メッセージ本文の共通バリデーション（フロント/サーバー共通の pure 関数）。
 *
 * - 文字数: Discord の1メッセージ本文の上限（2000文字。通常メッセージ・Webhook 共通）に収まるか
 * - メンション: @everyone / @here を許可しない場合、本文に含まれていたら弾く
 *
 * server-only の依存を持たない pure 関数なので、API 経路でもクライアント入力でも
 * 同じ判定で弾ける（既存の looksLikeDiscordWebhook / isDiscordWebhookUrl のような複製を避ける）。
 *
 * 補足: 実際のメンション解釈（@everyone 等のピング）は送信ペイロードの allowed_mentions で
 * 抑止する（本関数の検証とは独立した二重防御）。Discord の allowed_mentions.parse は
 * "everyone"（@everyone と @here の両方）/ "roles" / "users" の粒度しか持たず、
 * @here だけ許可といった分岐はできない点に注意。
 */

/** Discord の1メッセージ本文の最大文字数（通常メッセージ・Webhook 共通） */
export const DISCORD_MESSAGE_MAX_LENGTH = 2000

/** @everyone / @here を許可するか（未指定はどちらも false = 禁止） */
export type MentionAllowance = {
  everyone?: boolean
  here?: boolean
}

/** バリデーション結果。失敗時は理由（UI 表示・ログ用）を返す */
export type DiscordMessageValidation = { ok: true } | { ok: false; reason: string }

/**
 * Discord メッセージ本文として送信可能かを検証する。
 * @param text 本文
 * @param allow @everyone / @here を許可するか（既定はどちらも禁止）
 */
export function validateDiscordMessageContent(text: string, allow?: MentionAllowance): DiscordMessageValidation {
  if (text.length === 0) {
    return { ok: false, reason: "本文が空です" }
  }
  if (text.length > DISCORD_MESSAGE_MAX_LENGTH) {
    return { ok: false, reason: `本文が長すぎます（${DISCORD_MESSAGE_MAX_LENGTH}文字以内）` }
  }
  if (!allow?.everyone && text.includes("@everyone")) {
    return { ok: false, reason: "@everyone は使用できません" }
  }
  if (!allow?.here && text.includes("@here")) {
    return { ok: false, reason: "@here は使用できません" }
  }
  return { ok: true }
}
