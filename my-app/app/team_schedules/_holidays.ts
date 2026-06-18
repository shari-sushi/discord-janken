/**
 * 日本の祝日判定（外部依存なし・現行制度ベース）。
 *
 * 対象は本ツールが扱う「今日から数週間」の近未来日付なので、現行（2020年以降）の
 * 祝日ルールのみを実装する（過去の改称・特例日=五輪移動などは扱わない）。
 * - 固定日の祝日
 * - ハッピーマンデー（成人の日・海の日・敬老の日・スポーツの日）
 * - 春分の日・秋分の日（近似式。1980〜2099年で有効）
 * - 振替休日（祝日が日曜→次の平日が休日）
 * - 国民の休日（祝日に挟まれた平日）
 */

/** 月内 n 番目の指定曜日の「日」を返す（weekday: 0=日 … 1=月） */
function nthWeekdayOfMonth(year: number, month1to12: number, weekday: number, nth: number): number {
  const firstDow = new Date(year, month1to12 - 1, 1).getDay()
  const offset = (weekday - firstDow + 7) % 7
  return 1 + offset + (nth - 1) * 7
}

/** 春分の日（1980〜2099で有効な近似式） */
function vernalEquinoxDay(year: number): number {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
}

/** 秋分の日（1980〜2099で有効な近似式） */
function autumnalEquinoxDay(year: number): number {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
}

/** 振替休日・国民の休日を除いた「本来の祝日」名を返す（なければ null） */
function baseHolidayName(date: Date): string | null {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()

  switch (m) {
    case 1:
      if (d === 1) return "元日"
      if (d === nthWeekdayOfMonth(y, 1, 1, 2)) return "成人の日"
      return null
    case 2:
      if (d === 11) return "建国記念の日"
      if (d === 23) return "天皇誕生日"
      return null
    case 3:
      if (d === vernalEquinoxDay(y)) return "春分の日"
      return null
    case 4:
      if (d === 29) return "昭和の日"
      return null
    case 5:
      if (d === 3) return "憲法記念日"
      if (d === 4) return "みどりの日"
      if (d === 5) return "こどもの日"
      return null
    case 7:
      if (d === nthWeekdayOfMonth(y, 7, 1, 3)) return "海の日"
      return null
    case 8:
      if (d === 11) return "山の日"
      return null
    case 9:
      if (d === nthWeekdayOfMonth(y, 9, 1, 3)) return "敬老の日"
      if (d === autumnalEquinoxDay(y)) return "秋分の日"
      return null
    case 10:
      if (d === nthWeekdayOfMonth(y, 10, 1, 2)) return "スポーツの日"
      return null
    case 11:
      if (d === 3) return "文化の日"
      if (d === 23) return "勤労感謝の日"
      return null
    default:
      return null
  }
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(date.getDate() + days)
  return next
}

/** 振替休日か（自身は祝日でなく、遡って連続する祝日の先頭が日曜の祝日） */
function isSubstituteHoliday(date: Date): boolean {
  if (baseHolidayName(date)) return false
  let cur = addDays(date, -1)
  while (baseHolidayName(cur)) {
    if (cur.getDay() === 0) return true
    cur = addDays(cur, -1)
  }
  return false
}

/** 国民の休日か（自身は祝日でも日曜でもなく、前後の日が共に本来の祝日） */
function isCitizensHoliday(date: Date): boolean {
  if (baseHolidayName(date) || date.getDay() === 0) return false
  return !!baseHolidayName(addDays(date, -1)) && !!baseHolidayName(addDays(date, 1))
}

/** 日本の祝日なら名称、平日なら null を返す */
export function japaneseHolidayName(date: Date): string | null {
  const base = baseHolidayName(date)
  if (base) return base
  if (isSubstituteHoliday(date)) return "振替休日"
  if (isCitizensHoliday(date)) return "国民の休日"
  return null
}
