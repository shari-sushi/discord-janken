import { NextResponse } from "next/server"
import { and, eq, inArray } from "drizzle-orm"
import {
  InteractionResponseType,
  MessageFlags,
  ComponentType,
  ButtonStyle,
  type APIChatInputApplicationCommandInteraction,
  type APIMessageComponentInteraction,
  type APIUser,
} from "discord-api-types/v10"
import { db } from "@/app/_server/lib/db"
import { teamMembers, teams, discordLinks } from "@/app/_domains/teamSchedules/_server/schema"
import { createInviteToken, type InvitePayload } from "@/app/_domains/teamSchedules/_server/invites"
import { resolveOrCreateUserByDiscordId } from "@/app/_domains/teamSchedules/_server/userResolver"
import { inviteKey } from "@/app/_domains/teamSchedules/_server/redisKeys"
import { redisGet } from "@/app/_server/lib/redis/redis"
import { CLIENT_ACTIONS } from "@/app/_server/util/commands"
import { extractInviteToken } from "@/app/api/discord/util/extractCustomIdParam"

/** チーム情報（名前表示用の最小限） */
type TeamRef = { teamId: string; name: string }

/** コマンド／ボタン共通でユーザー情報を取り出す（DM・サーバーどちらからでも呼べる） */
function extractUser(user: APIUser | undefined): { discordUserId?: string; username: string } {
  return {
    discordUserId: user?.id,
    username: user?.global_name ?? user?.username ?? "Discordユーザー",
  }
}

/** ephemeral テキスト返信のショートハンド（本人にだけ表示） */
function ephemeral(content: string): NextResponse {
  return NextResponse.json({
    type: InteractionResponseType.ChannelMessageWithSource,
    data: { content, flags: MessageFlags.Ephemeral },
  })
}

/** discordUserId に紐づくアプリ userId を返す（リンクが無ければ null） */
async function findUserIdByDiscordId(discordUserId: string): Promise<string | null> {
  const rows = await db.select({ userId: discordLinks.userId }).from(discordLinks).where(eq(discordLinks.discordUserId, discordUserId)).limit(1)
  return rows[0]?.userId ?? null
}

/** その userId が master / admin として管理しているチーム一覧 */
async function findManagedTeams(userId: string): Promise<TeamRef[]> {
  return db
    .select({ teamId: teams.teamId, name: teams.name })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.teamId, teamMembers.teamId))
    .where(and(eq(teamMembers.userId, userId), inArray(teamMembers.teamRole, ["master", "admin"])))
}

/** 招待トークンを発行し、公開の募集メッセージ（参加ボタン付き）を返す */
async function buildRecruitMessage(team: TeamRef, invitedBy: string): Promise<NextResponse> {
  const token = await createInviteToken(team.teamId, invitedBy)
  return NextResponse.json({
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: [`🎟️ **${team.name}** がメンバーを募集しています！`, "", "下のボタンを押すと、このチームに参加できます（Discordログイン不要）。"].join("\n"),
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button,
              style: ButtonStyle.Success,
              label: "参加する",
              custom_id: `${CLIENT_ACTIONS.TEAM_SCHEDULE.JOIN}?invite=${token}`,
            },
          ],
        },
      ],
    },
  })
}

/** 招待トークンから参加先チームを解決する（期限切れ・チーム削除済みは null） */
async function resolveInviteTeam(token: string): Promise<TeamRef | null> {
  const payload = await redisGet<InvitePayload>(inviteKey(token))
  if (!payload) return null
  const rows = await db.select({ teamId: teams.teamId, name: teams.name }).from(teams).where(eq(teams.teamId, payload.teamId)).limit(1)
  return rows[0] ?? null
}

/** member ロールでチームに参加させる（既に所属していれば冪等に無視） */
async function joinAsMember(teamId: string, userId: string): Promise<void> {
  await db.insert(teamMembers).values({ teamId, userId, teamRole: "member" }).onConflictDoNothing({
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

  const userId = await findUserIdByDiscordId(discordUserId)
  // リンクが無い＝アプリ未登録なので管理チームも無い
  if (!userId) {
    return ephemeral("あなたが管理しているチームがありません。")
  }

  const managed = await findManagedTeams(userId)
  if (managed.length === 0) {
    return ephemeral("あなたが管理しているチームがありません。")
  }

  if (managed.length === 1) {
    return buildRecruitMessage(managed[0], userId)
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
 */
export async function handleSelectInviteTeam(interaction: APIMessageComponentInteraction): Promise<NextResponse> {
  const { discordUserId } = extractUser(interaction.member?.user ?? interaction.user)
  if (!discordUserId) {
    return ephemeral("ユーザー情報を取得できませんでした。再度お試しください。")
  }

  const teamId = interaction.data && "values" in interaction.data ? interaction.data.values?.[0] : undefined
  if (!teamId) {
    return ephemeral("チームが選択されていません。")
  }

  const userId = await findUserIdByDiscordId(discordUserId)
  if (!userId) {
    return ephemeral("あなたが管理しているチームがありません。")
  }

  // 選択チームが本当に自分の管理チームか再確認（存在を隠す意図で同じ汎用エラー）
  const managed = await findManagedTeams(userId)
  const team = managed.find((t) => t.teamId === teamId)
  if (!team) {
    return ephemeral("そのチームの募集ボタンを発行する権限がありません。")
  }

  return buildRecruitMessage(team, userId)
}

/**
 * 公開メッセージの「参加する」ボタン。
 * 押した人を（Discordログイン不要で）member 参加させる。
 * 既に別チームに所属している場合は追加加入の確認を出す（既存所属は抜けない）。
 */
export async function handleJoinButton(interaction: APIMessageComponentInteraction): Promise<NextResponse> {
  const token = extractInviteToken(interaction.data.custom_id)
  if (!token) {
    return ephemeral("招待リンクが不正です。")
  }

  const team = await resolveInviteTeam(token)
  if (!team) {
    return ephemeral("招待リンクの有効期限が切れているか、無効です。チーム管理者に再発行を依頼してください。")
  }

  const { discordUserId, username } = extractUser(interaction.member?.user ?? interaction.user)
  if (!discordUserId) {
    return ephemeral("ユーザー情報を取得できませんでした。再度お試しください。")
  }

  const { userId } = await resolveOrCreateUserByDiscordId(discordUserId, username)

  // 現在の所属チームを取得（対象チーム既参加 / 別チーム所属の判定）
  const myTeams = await db
    .select({ teamId: teamMembers.teamId, name: teams.name })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.teamId, teamMembers.teamId))
    .where(eq(teamMembers.userId, userId))

  if (myTeams.some((t) => t.teamId === team.teamId)) {
    return ephemeral(`すでに「${team.name}」に参加済みです。`)
  }

  // 別チームに所属している場合は追加加入の確認を出す（抜けずに追加）
  if (myTeams.length > 0) {
    const others = myTeams.map((t) => `「${t.name}」`).join("、")
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `あなたは既に ${others} に所属しています。「${team.name}」にも参加しますか？（今の所属はそのまま残ります）`,
        flags: MessageFlags.Ephemeral,
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                style: ButtonStyle.Success,
                label: "参加する",
                custom_id: `${CLIENT_ACTIONS.TEAM_SCHEDULE.CONFIRM_JOIN}?invite=${token}`,
              },
            ],
          },
        ],
      },
    })
  }

  // どこにも所属していない: そのまま参加
  await joinAsMember(team.teamId, userId)
  return ephemeral(`「${team.name}」に参加しました！`)
}

/**
 * 別チーム所属者向けの「参加する」確認ボタン。
 * トークンとユーザーを再解決して追加加入する。
 */
export async function handleConfirmJoinButton(interaction: APIMessageComponentInteraction): Promise<NextResponse> {
  const token = extractInviteToken(interaction.data.custom_id)
  if (!token) {
    return ephemeral("招待リンクが不正です。")
  }

  const team = await resolveInviteTeam(token)
  if (!team) {
    return ephemeral("招待リンクの有効期限が切れているか、無効です。チーム管理者に再発行を依頼してください。")
  }

  const { discordUserId, username } = extractUser(interaction.member?.user ?? interaction.user)
  if (!discordUserId) {
    return ephemeral("ユーザー情報を取得できませんでした。再度お試しください。")
  }

  const { userId } = await resolveOrCreateUserByDiscordId(discordUserId, username)
  await joinAsMember(team.teamId, userId)
  return ephemeral(`「${team.name}」に参加しました！`)
}
