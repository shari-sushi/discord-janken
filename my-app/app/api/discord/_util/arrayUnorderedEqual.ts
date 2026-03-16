export const arrayUnorderedEqual = <T>(a: T[], b: T[]): boolean => {
  if (a.length !== b.length) return false

  const count = new Map<T, number>()

  for (const v of a) {
    count.set(v, (count.get(v) ?? 0) + 1)
  }

  for (const v of b) {
    const n = count.get(v)
    if (n == null || n === 0) {
      return false
    }
    count.set(v, n - 1)
  }

  return [...count.values()].every((v) => v === 0)
}
