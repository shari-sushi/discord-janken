export const analyzeSummonersText = (text: string, selfTeam: string[] = []) => {
  const parsed = parseLine(text)
  const selfSet = new Set(selfTeam.map((s) => s.toLowerCase()))
  // 自チームメンバーはチェックを外した状態でリストに残す（除外はせず表示）
  // lolのサモナーネームは大文字小文字を区別しないため存在チェックはloweCaseでまとめて行う
  return parsed.map((name) => ({ name, checked: !selfSet.has(name.toLowerCase()) }))
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
