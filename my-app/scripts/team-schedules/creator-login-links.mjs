// スクリム調整機能（/team_schedules）の「チーム作成権限を持つ人」用ログインリンク発行スクリプト。
//
// .env の TEAM_SCHEDULE_CREATOR_DISCORD_IDS（カンマ区切りの Discord ユーザーID）を読み取り、
// その数だけアプリユーザー（member）を作成（既にいれば再利用）し、各人の magic-link
// ログインURL（Redis のワンタイムトークン）を発行・表示する。
// 発行したURLをブラウザで開けば、Discord を介さずにそのユーザーとしてログインできる。
//
// ユーザー作成ロジックは app/_domains/teamSchedules/_server/userResolver.ts と同じ流儀:
//   discord_links を引いて既存ユーザーがいれば再利用、無ければ users + discord_links を作成。
//
// 使い方（必ず my-app ディレクトリで実行・接続先を間違えないこと）:
//   cd my-app
//   node scripts/team-schedules/creator-login-links.mjs                 # member作成 + ログインURL発行
//   node scripts/team-schedules/creator-login-links.mjs --login-only    # 作成せず、既存ユーザーのログインURLだけ再発行
//
// 接続先は my-app の .env.local / .env の DATABASE_URL / REDIS_URL / APP_URL を使う
// （next dev と同じ優先順位。コマンド先頭で `APP_URL=http://localhost:3000 node ...` のように上書きも可能）。
// 注意: magic-link は「dev サーバーが読む Redis」に書く必要があるため、
//       REDIS_URL は起動中の next dev と同じものを指すこと。
//
// 安全弁: DATABASE_URL が neon.tech（本番/プレビュー想定）の場合は、
//         誤爆防止のため CONFIRM_SEED=yes を付けないと実行できない。

import "../loadEnv.mjs"
import { randomBytes } from "crypto"
import { Pool } from "pg"
import { createClient } from "redis"

// --- 環境変数 ----------------------------------------------------------------

const MAGIC_LINK_TTL = Number(process.env.MAGIC_LINK_TTL_SECONDS ?? 3600) // dev 便宜上デフォルト1時間（本番のコマンドは600秒）

const databaseUrl = process.env.DATABASE_URL
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379"
// APP_URL は末尾スラッシュを除去（env.ts と同じ正規化）
const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "")

const loginOnly = process.argv.includes("--login-only")

if (!databaseUrl) {
  console.error("ERROR: DATABASE_URL がありません。my-app/.env に設定するか、コマンド先頭で DATABASE_URL=... を指定してください。")
  process.exit(1)
}

// TEAM_SCHEDULE_CREATOR_DISCORD_IDS を , で split（前後空白除去・空要素/重複除去）
const creatorIds = [
  ...new Set(
    (process.env.TEAM_SCHEDULE_CREATOR_DISCORD_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  ),
]

if (creatorIds.length === 0) {
  console.error("ERROR: TEAM_SCHEDULE_CREATOR_DISCORD_IDS が空です。my-app/.env にカンマ区切りで Discord ユーザーIDを設定してください。")
  process.exit(1)
}

const dbHost = (() => {
  try {
    return new URL(databaseUrl).hostname
  } catch {
    return "(parse error)"
  }
})()

// 本番DB（neon）への誤爆を防ぐ
if (databaseUrl.includes("neon.tech") && process.env.CONFIRM_SEED !== "yes") {
  console.error(`ERROR: DATABASE_URL が neon.tech を指しています（host: ${dbHost}）。本番/プレビューへの書き込みを意図する場合のみ CONFIRM_SEED=yes を付けてください。`)
  process.exit(1)
}

// --- ユーザー解決/作成（userResolver.ts と同じ流儀） -------------------------

/**
 * discordUserId に紐づくアプリユーザーを返す。無ければ作成する。
 * 戻り値: { userId, displayName, created }
 */
async function resolveOrCreateUser(pool, discordUserId) {
  // discord_links → users を join して1クエリで解決
  const existing = await pool.query(
    `SELECT dl.user_id AS "userId", u.display_name AS "displayName"
       FROM discord_links dl
       JOIN users u ON u.user_id = dl.user_id
      WHERE dl.discord_user_id = $1
      LIMIT 1`,
    [discordUserId],
  )
  if (existing.rows[0]) {
    return { ...existing.rows[0], created: false }
  }

  if (loginOnly) {
    return null // --login-only では作成しない
  }

  // 表示名は Discord ユーザー名が分からないため暫定値。本人がログイン後に変更可能。
  const displayName = `creator-${discordUserId}`
  // passwordless（magic-link）。password_hash は notNull のため空文字で埋める。
  const inserted = await pool.query(`INSERT INTO users (display_name, password_hash) VALUES ($1, '') RETURNING user_id AS "userId", display_name AS "displayName"`, [displayName])
  const userId = inserted.rows[0].userId
  await pool.query(`INSERT INTO discord_links (discord_user_id, user_id) VALUES ($1, $2)`, [discordUserId, userId])
  return { userId, displayName: inserted.rows[0].displayName, created: true }
}

// --- main --------------------------------------------------------------------

const pool = new Pool({ connectionString: databaseUrl })
const redis = createClient({ url: redisUrl })
redis.on("error", (err) => console.error("Redis Client Error:", err))

try {
  await redis.connect()
  console.log(`対象DB host: ${dbHost} / creator ${creatorIds.length}人`)
  if (loginOnly) {
    console.log("--login-only: member 作成はスキップし、既存ユーザーのログインURLのみ発行します。")
  }

  const lines = []
  let createdCount = 0
  let skippedCount = 0

  for (const discordUserId of creatorIds) {
    const user = await resolveOrCreateUser(pool, discordUserId)
    if (!user) {
      // --login-only で未作成のユーザー
      skippedCount++
      lines.push(`  [未作成のためスキップ] discordId=${discordUserId}`)
      continue
    }
    if (user.created) createdCount++

    // magic-link 発行（login.ts / seed と同じ形: key=ts:magic:{token}, value={discordUserId, username}）
    const token = randomBytes(32).toString("hex")
    const payload = JSON.stringify({ discordUserId, username: user.displayName })
    await redis.setEx(`ts:magic:${token}`, MAGIC_LINK_TTL, payload)
    const tag = user.created ? "新規作成" : "既存"
    lines.push(`  [${tag}] ${user.displayName} (discordId=${discordUserId})\n    ${appUrl}/team_schedules?token=${token}`)
  }

  const expiryMinutes = Math.round(MAGIC_LINK_TTL / 60)
  if (!loginOnly) {
    console.log(`member: 新規 ${createdCount}人 / 既存 ${creatorIds.length - createdCount}人`)
  }
  console.log(`\nログインURL（有効期限 ${expiryMinutes}分・各1回のみ・REDIS host: ${new URL(redisUrl).hostname}）:`)
  console.log(lines.join("\n"))
  if (skippedCount > 0) {
    console.log(`\n※ ${skippedCount}人は未作成のためスキップしました（--login-only を外せば作成されます）。`)
  }
  console.log("\n※ URLは next dev と同じ REDIS_URL / APP_URL に対して発行されている必要があります。")
  console.log("※ トークンが切れたら `node scripts/team-schedules/creator-login-links.mjs --login-only` で再発行できます。")
} catch (error) {
  console.error("失敗しました:", error)
  process.exitCode = 1
} finally {
  await pool.end()
  await redis.quit()
}
