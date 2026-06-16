const LOL_PREF = "lol-"
const DEV_PREF = "dev-"
const USER_PREF = "user-"
const FIGHTING_PREF = "fighting-"
const TEAM_SCHEDULE_PREF = "team-schedule-"

export const COMMANDS = {
  LOL: {
    NEW_MATCH: LOL_PREF + "new-match",
    RANDOM_SIDE: LOL_PREF + "random-side",
    ROLE_ROULETTE: LOL_PREF + "role-roulette",
  },
  USER: {
    TIMER: USER_PREF + "timer",
    COMMON_MESSAGE: USER_PREF + "common-message",
    FEEDBACK: USER_PREF + "feedback",
    MENTION_REACTORS: USER_PREF + "mention-reactors",
  },
  FIGHTING: {
    TEAM_ORDER: FIGHTING_PREF + "team-order",
  },
  TEAM_SCHEDULE: {
    LOGIN: TEAM_SCHEDULE_PREF + "login",
    INVITE: TEAM_SCHEDULE_PREF + "invite",
  },
  // 開発者用
  DEV: {
    ECHO: DEV_PREF + "echo",
    TEST: DEV_PREF + "test",
  },
}

export const CLIENT_ACTIONS = {
  LOL: {
    OPEN_MODAL_BLUE_TEAM_REGISTER: "open-modal-blue-team-register",
    OPEN_MODAL_RED_TEAM_REGISTER: "open-modal-red-team-register",
    REGISTER_BLUE_TEAM: "register-blue-team",
    REGISTER_RED_TEAM: "register-red-team",
    CHECK_REGISTERED: "check-registered",
    RESET_REGISTERED: "reset-registered",
    OPEN_MODAL_TIMER: "open-modal-timer",
    SUBMIT_TIMER: "submit-timer-lol-new-match",
    ROLE_ROULETTE_START: LOL_PREF + "role-roulette-start",
    ROLE_ROULETTE_RESET: LOL_PREF + "role-roulette-reset",
  },
  USER: {
    SELECT_FEEDBACK_TYPE: "select-feedback-type",
    SUBMIT_TIMER: "submit-timer",
    SUBMIT_NEW_COMMON_MESSAGE: "submit-new-common-message",
    OPEN_MODAL_EDIT_COMMON_MESSAGE: "open-modal-edit-common-message",
    SUBMIT_COMMON_MESSAGE: "submit-common-message",
    FORCE_END_EDITING_COMMON_MESSAGE: "force-end-editing-common-message",
    SUBMIT_FEEDBACK: "submit-feedback",
  },
  FIGHTING: {
    OPEN_MODAL_TEAM1_ORDER: "fighting-open-modal-team1-order",
    OPEN_MODAL_TEAM2_ORDER: "fighting-open-modal-team2-order",
    REGISTER_TEAM1_ORDER: "fighting-register-team1-order",
    REGISTER_TEAM2_ORDER: "fighting-register-team2-order",
    RESET_TEAM_ORDER: "fighting-reset-team-order",
  },
  TEAM_SCHEDULE: {
    REISSUE_LOGIN: TEAM_SCHEDULE_PREF + "reissue-login",
    // 複数チーム管理者向け: 招待対象チームのセレクトメニュー
    SELECT_INVITE_TEAM: TEAM_SCHEDULE_PREF + "select-invite-team",
    // 公開メッセージの参加ボタン（custom_id に ?invite={token}）
    JOIN: TEAM_SCHEDULE_PREF + "join",
    // 別チーム所属者向けの追加加入 確認ボタン（custom_id に ?invite={token}）
    CONFIRM_JOIN: TEAM_SCHEDULE_PREF + "confirm-join",
  },
}
