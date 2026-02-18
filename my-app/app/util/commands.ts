const LOL_PREF = "lol-"
const DEV_PREF = "dev-"
const USER_PREF = "user-"

export const COMMANDS = {
  LOL: {
    NEW_PROTECT: LOL_PREF + "new-protect",
  },
  USER: {
    FEEDBACK: USER_PREF + "feedback",
    TIMER: USER_PREF + "timer",
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
  },
  USER: {
    SELECT_FEEDBACK_TYPE: "select-feedback-type",
    SUBMIT_FEEDBACK: "submit-feedback",
    SUBMIT_TIMER: "submit-timer",
  },
}

// https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object-interaction-type
export const DISCORD_INTERACTION_TYPE = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3, // ボタンクリックとか
  APPLICATION_COMMAND_AUTOCOMPLETE: 4,
  MODAL_SUBMIT: 5,
}
