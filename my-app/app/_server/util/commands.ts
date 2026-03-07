const LOL_PREF = "lol-"
const DEV_PREF = "dev-"
const USER_PREF = "user-"
const FIGHTING_PREF = "fighting-"

export const COMMANDS = {
  LOL: {
    NEW_MATCH: LOL_PREF + "new-match",
  },
  USER: {
    TIMER: USER_PREF + "timer",
    COMMON_MESSAGE: USER_PREF + "common-message",
    FEEDBACK: USER_PREF + "feedback",
    INFO: USER_PREF + "user-info"
  },
  FIGHTING: {
    TEAM_ORDER: FIGHTING_PREF + "team-order",
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
}
