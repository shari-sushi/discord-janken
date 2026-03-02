/**
 * テスト用のサンプルデータ
 * ↑それぞれのテストが独立しているべきだと思うのでどうしても使いたい時だけに限りたい
 */

/**
 * テスト用matchID（固定値）
 */
export const TEST_MATCH_ID = "test-match-id-12345"

/**
 * テスト用チャンネルID
 */
export const TEST_CHANNEL_ID = "test-channel-id"

/**
 * テスト用ギルドID
 */
export const TEST_GUILD_ID = "test-guild-id"

/**
 * テスト用ユーザーID
 */
export const TEST_USER_ID = "test-user-id-123"

/**
 * テスト用メッセージID
 */
export const TEST_MESSAGE_ID = "test-message-id"

/**
 * テスト用チャンピオン名
 */
export const SAMPLE_CHAMPIONS = {
  BLUE_TEAM: "ポッピー、エズ",
  RED_TEAM: "アジール、ライズ",
}

/**
 * テスト用ロール選択データ
 */
export const SAMPLE_ROLES = {
  TOP: "Player1",
  JG: "Player2",
  MID: "Player3",
  ADC: "Player4",
  SUP: "Player5",
}

/**
 * テスト用プロテクトデータ
 */
export const SAMPLE_PROTECT_DATA = {
  blue_team: {
    protect: SAMPLE_CHAMPIONS.BLUE_TEAM,
    userId: TEST_USER_ID,
    updatedAt: new Date().toISOString(),
  },
  red_team: {
    protect: SAMPLE_CHAMPIONS.RED_TEAM,
    userId: TEST_USER_ID,
    updatedAt: new Date().toISOString(),
  },
}

/**
 * UUIDフォーマットのmatchIDを生成
 */
export const generateMatchId = (): string => {
  return "test-" + Math.random().toString(36).substring(2, 15)
}
