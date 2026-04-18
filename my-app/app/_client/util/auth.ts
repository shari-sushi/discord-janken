export function buildBasicAuth(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`
}
