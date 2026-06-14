// Riot ID のバリデーション
// 参照: https://support-valorant.riotgames.com/hc/ja/articles/20631086710163-Riot-ID%E3%81%AE%E5%A4%89%E6%9B%B4
//
// Riot ID は「ゲーム名#タグライン」の形式
// - ゲーム名: 3〜16文字
//   ※公式ドキュメントでは英数字と明記されているが、実際には様々な言語のゲーム名が確認されているため文字種は検証しない
// - タグライン: 3〜5文字の半角英数字

export type RiotIdValidationResult = { valid: true } | { valid: false; error: string }

export function validateRiotId(value: string): RiotIdValidationResult {
  const parts = value.split("#")
  if (parts.length !== 2) {
    return { valid: false, error: "「ゲーム名#タグライン」の形式で入力してください（例: Player#JP1）" }
  }

  const [gameName, tagLine] = parts

  if (gameName.length < 3 || gameName.length > 16) {
    return { valid: false, error: `ゲーム名は3〜16文字で入力してください（現在: ${gameName.length}文字）` }
  }

  if (tagLine.length < 3 || tagLine.length > 5) {
    return { valid: false, error: `タグラインは3〜5文字で入力してください（現在: ${tagLine.length}文字）` }
  }

  if (!/^[a-zA-Z0-9]+$/.test(tagLine)) {
    return { valid: false, error: "タグラインは半角英数字のみ使用できます" }
  }

  return { valid: true }
}
