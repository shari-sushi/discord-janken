export const analyzeSummonersText = (text: string, selfTeam: string[] = []) => {
  const parsed = parseLine(text)
  const selfSet = new Set(selfTeam.map((s) => s.toLowerCase()))
  const filtered = parsed.filter((name) => !selfSet.has(name.toLowerCase()))
  return filtered.map((name) => ({ name, checked: true }))
}

// TODO: 記述ミスを考慮し、何らかの形で除外されたものも返すようにするか検討する
// その方が、ユーザーが見落としにくくなる
const parseLine = (line: string): string[] => {
  return (
    line
      // ", ", ",", 改行, "@", "＠" で分割
      .split(/[,@＠\n]|, /)
      // trim
      .map((s) => s.trim())
      // 空文字除去（ついでにやっとくと安全）
      .filter((s) => s.length > 0)
      // #で分割して長さが2のものだけ残す
      .filter((s) => s.split("#").length === 2)
  )
}
