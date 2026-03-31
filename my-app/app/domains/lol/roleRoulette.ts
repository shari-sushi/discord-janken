export const ROLE_EMOJIS = {
  TOP: "1️⃣",
  JG: "2️⃣",
  MID: "3️⃣",
  ADC: "4️⃣",
  SUP: "5️⃣",
  FILL: "*️⃣",
} as const

export const ROLE_LABELS: Record<Exclude<keyof typeof ROLE_EMOJIS, "FILL">, string> = {
  TOP: "TOP",
  JG: "JG",
  MID: "MID",
  ADC: "ADC",
  SUP: "SUP",
}

export type RoleKey = keyof typeof ROLE_LABELS
export type RoleAssignment = Record<RoleKey, string> // roleKey -> userId

export type RouletteResult = { ok: true; assignment: RoleAssignment; rest: string[] } | { ok: false; error: string }

export const ROLE_KEYS: RoleKey[] = ["TOP", "JG", "MID", "ADC", "SUP"]
const MAX_ATTEMPTS = 100

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * ロール抽選を実行する
 * @param reactorsByRole - ロールごとのリアクションユーザーID（Bot除外前）
 * @param botId - 除外するBot ID
 */
export function runRoleRoulette(reactorsByRole: Record<RoleKey | "FILL", string[]>, botId: string): RouletteResult {
  // 1. Bot除外
  const cleaned: Record<RoleKey | "FILL", string[]> = {
    TOP: reactorsByRole.TOP.filter((id) => id !== botId),
    JG: reactorsByRole.JG.filter((id) => id !== botId),
    MID: reactorsByRole.MID.filter((id) => id !== botId),
    ADC: reactorsByRole.ADC.filter((id) => id !== botId),
    SUP: reactorsByRole.SUP.filter((id) => id !== botId),
    FILL: reactorsByRole.FILL.filter((id) => id !== botId),
  }

  // 2. ユニーク参加者集計
  const allIds = new Set([...cleaned.TOP, ...cleaned.JG, ...cleaned.MID, ...cleaned.ADC, ...cleaned.SUP, ...cleaned.FILL])
  const uniqueParticipants = Array.from(allIds)

  // 3. バリデーション①: 参加者5人未満
  if (uniqueParticipants.length < 5) {
    return { ok: false, error: "参加希望者は5人必要です" }
  }

  // 4. バリデーション②: 各ロールを担当できる人がいない
  for (const role of ROLE_KEYS) {
    const eligible = [...new Set([...cleaned[role], ...cleaned.FILL])]
    if (eligible.length === 0) {
      return { ok: false, error: `${ROLE_LABELS[role]} ができる人がいません` }
    }
  }

  // 5〜7. MAX_ATTEMPTS 回試行
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // 6. 参加者シャッフル → 先頭5人をcandidates、残りをrest
    const shuffled = shuffle(uniqueParticipants)
    const candidates = shuffled.slice(0, 5)
    const rest = shuffled.slice(5)
    const candidateSet = new Set(candidates)

    // 5. 適格性マップ構築（candidatesの中で担当できる人）
    const eligibilityMap: Record<RoleKey, string[]> = {
      TOP: [...new Set([...cleaned.TOP, ...cleaned.FILL])].filter((id) => candidateSet.has(id)),
      JG: [...new Set([...cleaned.JG, ...cleaned.FILL])].filter((id) => candidateSet.has(id)),
      MID: [...new Set([...cleaned.MID, ...cleaned.FILL])].filter((id) => candidateSet.has(id)),
      ADC: [...new Set([...cleaned.ADC, ...cleaned.FILL])].filter((id) => candidateSet.has(id)),
      SUP: [...new Set([...cleaned.SUP, ...cleaned.FILL])].filter((id) => candidateSet.has(id)),
    }

    // 7. バックトラッキングでロール割り当て
    const shuffledRoles = shuffle([...ROLE_KEYS])
    const assignment: Partial<Record<RoleKey, string>> = {}
    const used = new Set<string>()

    const backtrack = (roleIdx: number): boolean => {
      if (roleIdx === shuffledRoles.length) return true
      const role = shuffledRoles[roleIdx]
      const eligible = shuffle(eligibilityMap[role].filter((id) => !used.has(id)))
      for (const userId of eligible) {
        assignment[role] = userId
        used.add(userId)
        if (backtrack(roleIdx + 1)) return true
        delete assignment[role]
        used.delete(userId)
      }
      return false
    }

    if (backtrack(0)) {
      return {
        ok: true,
        assignment: assignment as RoleAssignment,
        rest,
      }
    }
  }

  return { ok: false, error: "有効な割り当てが見つかりませんでした。役職希望の偏りを見直してください。" }
}
