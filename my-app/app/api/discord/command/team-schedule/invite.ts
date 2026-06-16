import { NextResponse } from "next/server"
import { after } from "next/server"
import { and, eq, inArray } from "drizzle-orm"
import {
  InteractionResponseType,
  MessageFlags,
  ComponentType,
  ButtonStyle,
  type APIChatInputApplicationCommandInteraction,
  type APIMessageComponentInteraction,
  type APIUser,
  type APIActionRowComponent,
  type APIComponentInMessageActionRow,
} from "discord-api-types/v10"
import { db } from "@/app/_server/lib/db"
import { teamMembers, teams, discordLinks } from "@/app/_domains/teamSchedules/_server/schema"
import { createInviteToken, type InvitePayload } from "@/app/_domains/teamSchedules/_server/invites"
import { resolveOrCreateUserByDiscordId } from "@/app/_domains/teamSchedules/_server/userResolver"
import { inviteKey } from "@/app/_domains/teamSchedules/_server/redisKeys"
import { redisGet } from "@/app/_server/lib/redis/redis"
import { editWebhookOriginalMessage } from "@/app/_server/lib/discord/api"
import { CLIENT_ACTIONS } from "@/app/_server/util/commands"
import { extractInviteToken } from "@/app/api/discord/util/extractCustomIdParam"

/** チーム情報（名前表示用の最小限） */
type TeamRef = { teamId: string; name: string }

/** 招待トークンから解決した参加先（チーム + 発行者）。invitedBy は記録用（#108） */
type ResolvedInvite = TeamRef & { invitedBy?: string }

/** Discord に返す（または webhook で差し替える）メッセージ本体 */
type MessageContent = { content: string; components?: APIActionRowComponent<APIComponentInMessageActionRow>[] }

/** コマンド／ボタン共通でユーザー情報を取り出す（DM・サーバーどちらからでも呼べる） */
function extractUser(user: APIUser | undefined): { discordUserId?: string; username: string } {
  return {
    discordUserId: user?.id,
    username: user?.global_name ?? user?.username ?? "Discordユーザー",
  }
}

/** ephemeral テキスト返信のショートハンド（本人にだけ表示・即時応答用） */
function ephemeral(content: string): NextResponse {
  return NextResponse.json({
    type: InteractionResponseType.ChannelMessageWithSource,
    data: { content, flags: MessageFlags.Ephemeral },
  })
}

/** ephemeral の deferred 応答（「考え中…」）。重い処理を after に逃がす際の即時 ACK */
function deferredEphemeral(): NextResponse {
  return NextResponse.json({
    type: InteractionResponseType.DeferredChannelMessageWithSource,
    data: { flags: MessageFlags.Ephemeral },
  })
}

/**
 * deferred 応答後に元メッセージを差し替える。
 * webhook 編集自体が失敗しても after 内で throw させない（ログのみ）。
 */
async function safeEdit(applicationId: string, token: string, content: string, components?: APIActionRowComponent<APIComponentInMessageActionRow>[]): Promise<void> {
  try {
    await editWebhookOriginalMessage(applicationId, token, content, components)
  } catch (e) {
    console.error("team-schedule invite: editWebhookOriginalMessage failed:", e)
  }
}

/** 「参加する」ボタン1個だけの ActionRow を作る（JOIN / CONFIRM_JOIN 共通） */
function joinButtonRow(action: string, token: string): APIActionRowComponent<APIComponentInMessageActionRow>[] {
  return [
    {
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button,
          style: ButtonStyle.Success,
          label: "参加する",
          custom_id: `${action}?invite=${token}`,
        },
      ],
    },
  ]
}

/** discordUserId に紐づくアプリ userId を返す（リンクが無ければ null） */
async function findUserIdByDiscordId(discordUserId: string): Promise<string | null> {
  const rows = await db.select({ userId: discordLinks.userId }).from(discordLinks).where(eq(discordLinks.discordUserId, discordUserId)).limit(1)
  return rows[0]?.userId ?? null
}

/**
 * discordUserId が master/admin として管理しているチーム一覧（+ アプリ userId）を1クエリで取得。
 * スラッシュコマンドの critical path（最も cold start を踏みやすい初回操作）の往復削減用。
 * 未登録・管理チーム0件はどちらも空配列を返す（呼び出し側のメッセージは同一）。
 */
async function findManagedTeamsByDiscordId(discordUserId: string): Promise<{ userId: string; teams: TeamRef[] }> {
  const rows = await db
    .select({ userId: teamMembers.userId, teamId: teams.teamId, name: teams.name })
    .from(discordLinks)
    .innerJoin(teamMembers, eq(teamMembers.userId, discordLinks.userId))
    .innerJoin(teams, eq(teams.teamId, teamMembers.teamId))
    .where(and(eq(discordLinks.discordUserId, discordUserId), inArray(teamMembers.teamRole, ["master", "admin"])))
  if (rows.length === 0) return { userId: "", teams: [] }
  return { userId: rows[0].userId, teams: rows.map((r) => ({ teamId: r.teamId, name: r.name })) }
}

/** その userId が master / admin として管理しているチーム一覧 */
async function findManagedTeams(userId: string): Promise<TeamRef[]> {
  return db
    .select({ teamId: teams.teamId, name: teams.name })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.teamId, teamMembers.teamId))
    .where(and(eq(teamMembers.userId, userId), inArray(teamMembers.teamRole, ["master", "admin"])))
}

/** 招待トークンを発行し、公開の募集メッセージ（参加ボタン付き）の中身を返す */
async function buildRecruitContent(team: TeamRef, invitedBy: string): Promise<MessageContent> {
  const token = await createInviteToken(team.teamId, invitedBy)
  return {
    content: [`🎟️ **${team.name}** がメンバーを募集しています！`, "", "下のボタンを押すと、このチームに参加できます（Discordログイン不要）。"].join("\n"),
    components: joinButtonRow(CLIENT_ACTIONS.TEAM_SCHEDULE.JOIN, token),
  }
}

/** 招待トークンから参加先チームを解決する（期限切れ・チーム削除済みは null）。発行者 invitedBy も返す */
async function resolveInviteTeam(token: string): Promise<ResolvedInvite | null> {
  const payload = await redisGet<InvitePayload>(inviteKey(token))
  if (!payload) return null
  const rows = await db.select({ teamId: teams.teamId, name: teams.name }).from(teams).where(eq(teams.teamId, payload.teamId)).limit(1)
  if (!rows[0]) return null
  return { ...rows[0], invitedBy: payload.invitedBy }
}

/**
 * member ロールでチームに参加させる（既に所属していれば冪等に無視）。
 * invitedBy は「誰のリンクで入ったか」の記録（#108）。再参加時は初回の発行者を上書きしない。
 */
async function joinAsMember(teamId: string, userId: string, invitedBy?: string): Promise<void> {
  await db.insert(teamMembers).values({ teamId, userId, teamRole: "member", invitedBy }).onConflictDoNothing({
    target: [teamMembers.teamId, teamMembers.userId],
  })
}

/**
 * `/team-schedule-invite` コマンド。
 * 実行者が master/admin のチームへの参加募集ボタンを投稿する。
 * - 管理チームが1つ: 公開メッセージを即投稿
 * - 複数: ephemeral のセレクトメニューで選ばせる
 */
export async function teamScheduleInviteCommand(interaction: APIChatInputApplicationCommandInteraction): Promise<NextResponse> {
  const { discordUserId } = extractUser(interaction.member?.user ?? interaction.user)
  if (!discordUserId) {
    return ephemeral("ユーザー情報を取得できませんでした。再度お試しください。")
  }

  // 未登録（リンク無し）も管理チーム0件も、1クエリで同じ空配列として扱う
  const { userId, teams: managed } = await findManagedTeamsByDiscordId(discordUserId)
  if (managed.length === 0) {
    return ephemeral("あなたが管理しているチームがありません。")
  }

  if (managed.length === 1) {
    const recruit = await buildRecruitContent(managed[0], userId)
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: recruit.content, components: recruit.components },
    })
  }

  // 複数チームの管理者: セレクトメニューで選ばせる（StringSelect は最大25件）
  return NextResponse.json({
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: "募集ボタンを出すチームを選んでください。",
      flags: MessageFlags.Ephemeral,
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.StringSelect,
              custom_id: CLIENT_ACTIONS.TEAM_SCHEDULE.SELECT_INVITE_TEAM,
              placeholder: "チームを選択",
              options: managed.slice(0, 25).map((t) => ({ label: t.name, value: t.teamId })),
            },
          ],
        },
      ],
    },
  })
}

/**
 * 複数チーム管理者のセレクトメニュー選択。
 * 選んだチームの管理権限を再確認し、公開の募集メッセージを投稿する。
 *
 * cold start（Vercel/Neon/Redis）で3秒制限を超えないよう、即 deferred で ACK し
 * 実処理は after に逃がして webhook 編集で結果を反映する。
 */
export function handleSelectInviteTeam(interaction: APIMessageComponentInteraction): NextResponse {
  const { token: interactionToken, application_id } = interaction

  after(async () => {
    try {
      const { discordUserId } = extractUser(interaction.member?.user ?? interaction.user)
      if (!discordUserId) {
        return safeEdit(application_id, interactionToken, "ユーザー情報を取得できませんでした。再度お試しください。")
      }

      const teamId = interaction.data && "values" in interaction.data ? interaction.data.values?.[0] : undefined
      if (!teamId) {
        return safeEdit(application_id, interactionToken, "チームが選択されていません。")
      }

      const userId = await findUserIdByDiscordId(discordUserId)
      if (!userId) {
        return safeEdit(application_id, interactionToken, "あなたが管理しているチームがありません。")
      }

      // 選択チームが本当に自分の管理チームか再確認（存在を隠す意図で同じ汎用エラー）
      const managed = await findManagedTeams(userId)
      const team = managed.find((t) => t.teamId === teamId)
      if (!team) {
        return safeEdit(application_id, interactionToken, "そのチームの募集ボタンを発行する権限がありません。")
      }

      const recruit = await buildRecruitContent(team, userId)
      return safeEdit(application_id, interactionToken, recruit.content, recruit.components)
    } catch (e) {
      console.error("handleSelectInviteTeam after error:", e)
      return safeEdit(application_id, interactionToken, "募集ボタンの投稿に失敗しました。しばらく待ってから再度お試しください。")
    }
  })

  // セレクト選択後は公開の募集メッセージを出すので ephemeral にしない
  return NextResponse.json({ type: InteractionResponseType.DeferredChannelMessageWithSource })
}

/**
 * 公開メッセージの「参加する」ボタン。
 * 押した人を（Discordログイン不要で）member 参加させる。
 * 既に別チームに所属している場合は追加加入の確認を出す（既存所属は抜けない）。
 *
 * user 作成や複数クエリで3秒を超え得るため即 deferred（ephemeral）で ACK し、
 * 実処理は after に逃がす。
 */
export function handleJoinButton(interaction: APIMessageComponentInteraction): NextResponse {
  const { token: interactionToken, application_id } = interaction

  after(async () => {
    try {
      const token = extractInviteToken(interaction.data.custom_id)
      if (!token) {
        return safeEdit(application_id, interactionToken, "招待リンクが不正です。")
      }

      const team = await resolveInviteTeam(token)
      if (!team) {
        return safeEdit(application_id, interactionToken, "招待リンクの有効期限が切れているか、無効です。チーム管理者に再発行を依頼してください。")
      }

      const { discordUserId, username } = extractUser(interaction.member?.user ?? interaction.user)
      if (!discordUserId) {
        return safeEdit(application_id, interactionToken, "ユーザー情報を取得できませんでした。再度お試しください。")
      }

      const { userId } = await resolveOrCreateUserByDiscordId(discordUserId, username)

      // 現在の所属チームを取得（対象チーム既参加 / 別チーム所属の判定）
      const myTeams = await db
        .select({ teamId: teamMembers.teamId, name: teams.name })
        .from(teamMembers)
        .innerJoin(teams, eq(teams.teamId, teamMembers.teamId))
        .where(eq(teamMembers.userId, userId))

      if (myTeams.some((t) => t.teamId === team.teamId)) {
        return safeEdit(application_id, interactionToken, `すでに「${team.name}」に参加済みです。`)
      }

      // 別チームに所属している場合は追加加入の確認を出す（抜けずに追加）
      if (myTeams.length > 0) {
        const others = myTeams.map((t) => `「${t.name}」`).join("、")
        return safeEdit(
          application_id,
          interactionToken,
          `あなたは既に ${others} に所属しています。「${team.name}」にも参加しますか？（今の所属はそのまま残ります）`,
          joinButtonRow(CLIENT_ACTIONS.TEAM_SCHEDULE.CONFIRM_JOIN, token),
        )
      }

      // どこにも所属していない: そのまま参加
      await joinAsMember(team.teamId, userId, team.invitedBy)
      return safeEdit(application_id, interactionToken, `「${team.name}」に参加しました！`)
    } catch (e) {
      console.error("handleJoinButton after error:", e)
      return safeEdit(application_id, interactionToken, "参加処理に失敗しました。しばらく待ってから再度お試しください。")
    }
  })

  return deferredEphemeral()
}

/**
 * 別チーム所属者向けの「参加する」確認ボタン。
 * トークンとユーザーを再解決して追加加入する。
 */
export function handleConfirmJoinButton(interaction: APIMessageComponentInteraction): NextResponse {
  const { token: interactionToken, application_id } = interaction

  after(async () => {
    try {
      const token = extractInviteToken(interaction.data.custom_id)
      if (!token) {
        return safeEdit(application_id, interactionToken, "招待リンクが不正です。")
      }

      const team = await resolveInviteTeam(token)
      if (!team) {
        return safeEdit(application_id, interactionToken, "招待リンクの有効期限が切れているか、無効です。チーム管理者に再発行を依頼してください。")
      }

      const { discordUserId, username } = extractUser(interaction.member?.user ?? interaction.user)
      if (!discordUserId) {
        return safeEdit(application_id, interactionToken, "ユーザー情報を取得できませんでした。再度お試しください。")
      }

      const { userId } = await resolveOrCreateUserByDiscordId(discordUserId, username)
      await joinAsMember(team.teamId, userId, team.invitedBy)
      return safeEdit(application_id, interactionToken, `「${team.name}」に参加しました！`)
    } catch (e) {
      console.error("handleConfirmJoinButton after error:", e)
      return safeEdit(application_id, interactionToken, "参加処理に失敗しました。しばらく待ってから再度お試しください。")
    }
  })

  return deferredEphemeral()
}
