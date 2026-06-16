/**
 * Server-Timing 計測ヘルパー
 *
 * 「推測せず計測」用。各 DB クエリ / Redis アクセスの所要時間を区間計測し、
 * `Server-Timing` レスポンスヘッダーに載せる。ブラウザの DevTools → Network →
 * 各リクエストの「Timing」タブに内訳が表示される。
 *
 * 使い方:
 *   const t = new ServerTiming()
 *   const rows = await t.measure("db_users", () => db.select()...)
 *   const res = NextResponse.json({ ... })
 *   t.applyTo(res)            // ヘッダーを付与
 *
 * total（このオブジェクト生成からの経過）も自動で載るため、
 * 「total −（各区間の総和）」でコールドスタート/接続オーバーヘッドを概算できる。
 */
export class ServerTiming {
  private readonly startedAt = Date.now()
  private readonly marks: { name: string; dur: number }[] = []

  /** 非同期処理を区間計測する（失敗時も計測する） */
  async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now()
    try {
      return await fn()
    } finally {
      this.marks.push({ name, dur: Date.now() - start })
    }
  }

  /** Server-Timing ヘッダー値を組み立てる */
  headerValue(): string {
    const entries = this.marks.map((m) => `${m.name};dur=${m.dur}`)
    entries.push(`total;dur=${Date.now() - this.startedAt}`)
    return entries.join(", ")
  }

  /** レスポンスにヘッダーを付与する */
  applyTo(res: { headers: Headers }): void {
    res.headers.set("Server-Timing", this.headerValue())
  }
}
