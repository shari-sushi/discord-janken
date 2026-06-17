// スクリム調整機能（/team_schedules）のローカル動作確認用シードスクリプト。
//
// Discord 経由でしかチーム/ユーザーを作れないため、ローカルDBに
// 「管理者(master)1人 + 一般メンバー2人 + チーム1つ + 数日ぶんの予定」を投入し、
// 各ユーザーの magic-link ログインURL（Redis のワンタイムトークン）を発行する。
// 発行したURLをブラウザで開けば、Discord を介さずにそのユーザーとしてログインできる。
//
// 使い方（必ず my-app ディレクトリで実行・接続先を間違えないこと）:
//   cd my-app
//   node scripts/seed-team-schedules.mjs                 # シード + 全ユーザーのログインURL発行
//   node scripts/seed-team-schedules.mjs --login-only    # シードせず、ログインURLだけ再発行（トークン失効時）
//
// 接続先は my-app/.env の DATABASE_URL / REDIS_URL / APP_URL を使う
// （コマンド先頭で `APP_URL=http://localhost:3000 node ...` のように上書きも可能）。
// 注意: magic-link は「dev サーバーが読む Redis」に書く必要があるため、
//       REDIS_URL は起動中の next dev と同じものを指すこと。
//
// 安全弁: DATABASE_URL が neon.tech（本番/プレビュー想定）の場合は、
//         誤爆防止のため CONFIRM_SEED=yes を付けないと実行できない。

import "dotenv/config"
import { randomBytes } from "crypto"
import { Pool } from "pg"
import { createClient } from "redis"

// --- 設定値（固定UUID/固定DiscordIDで冪等にする） ---------------------------

const MAGIC_LINK_TTL = Number(process.env.MAGIC_LINK_TTL_SECONDS ?? 3600) // dev 便宜上デフォルト1時間（本番のコマンドは600秒）

const TEAM = { teamId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "テストチーム（管理用）", description: "ローカル動作確認用のシードチーム", requiredCount: 3, managementMode: "members" }

// teamRole: master = 管理者（チームに1人）, member = 一般
const SEED_USERS = [
  { userId: "11111111-1111-4111-8111-111111111111", discordUserId: "900000000000000001", displayName: "テスト管理者", teamRole: "master" },
  { userId: "22222222-2222-4222-8222-222222222222", discordUserId: "900000000000000002", displayName: "テストメンバーA", teamRole: "member" },
  { userId: "33333333-3333-4333-8333-333333333333", discordUserId: "900000000000000003", displayName: "テストメンバーB", teamRole: "member" },
]

const loginOnly = process.argv.includes("--login-only")

// --- 環境変数 ----------------------------------------------------------------

const databaseUrl = process.env.DATABASE_URL
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379"
// APP_URL は末尾スラッシュを除去（env.ts と同じ正規化）
const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "")

if (!databaseUrl) {
  console.error("ERROR: DATABASE_URL がありません。my-app/.env に設定するか、コマンド先頭で DATABASE_URL=... を指定してください。")
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
  console.error(`ERROR: DATABASE_URL が neon.tech を指しています（host: ${dbHost}）。本番/プレビューへのシードを意図する場合のみ CONFIRM_SEED=yes を付けてください。`)
  process.exit(1)
}

// --- 日付ヘルパー（YYYY-MM-DD・ローカル日付） --------------------------------

function dayKey(offsetDays) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

// --- シード（DB書き込み） ----------------------------------------------------

async function seed(pool) {
  console.log(`シード対象DB host: ${dbHost}`)

  // users（display_name は更新、password_hash は magic-link 運用に合わせ空文字）
  for (const u of SEED_USERS) {
    await pool.query(
      `INSERT INTO users (user_id, display_name, password_hash) VALUES ($1, $2, '')
       ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name`,
      [u.userId, u.displayName],
    )
    // discord_links（discordUserId → userId）
    await pool.query(
      `INSERT INTO discord_links (discord_user_id, user_id) VALUES ($1, $2)
       ON CONFLICT (discord_user_id) DO UPDATE SET user_id = EXCLUDED.user_id`,
      [u.discordUserId, u.userId],
    )
  }

  // teams（既にテスト中で管理モード等を変更している可能性があるため、衝突時は何もしない＝状態を温存）
  await pool.query(
    `INSERT INTO teams (team_id, name, description, required_count, management_mode) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (team_id) DO NOTHING`,
    [TEAM.teamId, TEAM.name, TEAM.description, TEAM.requiredCount, TEAM.managementMode],
  )

  // team_members（ロールは常に整合させる）
  for (const u of SEED_USERS) {
    await pool.query(
      `INSERT INTO team_members (team_id, user_id, team_role) VALUES ($1, $2, $3)
       ON CONFLICT (team_id, user_id) DO UPDATE SET team_role = EXCLUDED.team_role`,
      [TEAM.teamId, u.userId, u.teamRole],
    )
  }

  // schedules（members モードのグリッドが空にならないよう、今日から数日ぶんを投入）
  const statuses = ["ok", "maybe", "ng"]
  let count = 0
  for (let i = 0; i < SEED_USERS.length; i++) {
    const u = SEED_USERS[i]
    for (let d = 0; d < 4; d++) {
      // ユーザー/日でずらして ok/maybe/ng を散らす
      const status = statuses[(i + d) % statuses.length]
      const note = status === "ok" ? "21:00~" : ""
      await pool.query(
        `INSERT INTO schedules (team_id, user_id, day, status, note) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (team_id, user_id, day) DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note, updated_at = now()`,
        [TEAM.teamId, u.userId, dayKey(d), status, note || null],
      )
      count++
    }
  }

  console.log(`シード完了: team「${TEAM.name}」/ users ${SEED_USERS.length}人 / schedules ${count}行`)
}

// --- magic-link 発行（Redis書き込み） ---------------------------------------

async function issueLoginLinks(redis) {
  const lines = []
  for (const u of SEED_USERS) {
    const token = randomBytes(32).toString("hex")
    // login.ts と同じ形: key=ts:magic:{token}, value={discordUserId, username}
    const payload = JSON.stringify({ discordUserId: u.discordUserId, username: u.displayName })
    await redis.setEx(`ts:magic:${token}`, MAGIC_LINK_TTL, payload)
    const roleLabel = u.teamRole === "master" ? "管理者(master)" : "メンバー"
    lines.push(`  [${roleLabel}] ${u.displayName}\n    ${appUrl}/team_schedules?token=${token}`)
  }
  const expiryMinutes = Math.round(MAGIC_LINK_TTL / 60)
  console.log(`\nログインURL（有効期限 ${expiryMinutes}分・各1回のみ・REDIS host: ${new URL(redisUrl).hostname}）:`)
  console.log(lines.join("\n"))
  console.log("\n※ URLは next dev と同じ REDIS_URL / APP_URL に対して発行されている必要があります。")
  console.log("※ トークンが切れたら `node scripts/seed-team-schedules.mjs --login-only` で再発行できます。")
}

// --- main --------------------------------------------------------------------

const pool = new Pool({ connectionString: databaseUrl })
const redis = createClient({ url: redisUrl })
redis.on("error", (err) => console.error("Redis Client Error:", err))

try {
  await redis.connect()
  if (!loginOnly) {
    await seed(pool)
  } else {
    console.log("--login-only: シードはスキップし、ログインURLのみ発行します。")
  }
  await issueLoginLinks(redis)
} catch (error) {
  console.error("失敗しました:", error)
  process.exitCode = 1
} finally {
  await pool.end()
  await redis.quit()
}
