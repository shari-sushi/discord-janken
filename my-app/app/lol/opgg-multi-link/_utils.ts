export function buildMultiUrl(names: string[]): string {
  return `https://op.gg/ja/lol/multisearch/jp?summoners=${names.map((n) => encodeURIComponent(n)).join(",")}`
}

export function buildPlayerUrl(name: string): string {
  return `https://op.gg/ja/lol/summoners/jp/${name.replace("#", "-")}`
}

export function buildBasicAuth(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`
}
