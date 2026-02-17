export const COMMAND_PREF = "lol-"

export const COMMANDS = {
  ECHO: COMMAND_PREF + "echo",
  NEW_PROTECT: COMMAND_PREF + "new-protect",
  FEEDBACK: COMMAND_PREF + "feedback",
  TIMER: COMMAND_PREF + "timer",
  // 動作確認用
  TEST: {
    ORIGIN: "test-develop",
    ONE: "test-develop-1",
  },
}

export const CLIENT_ACTIONS = {
  OPEN_MODAL_RED_TEAM_REGISTER: "open-modal-red-team-register",
  OPEN_MODAL_BLUE_TEAM_REGISTER: "open-modal-blue-team-register",
  REGISTER_RED_TEAM: "register-red-team",
  REGISTER_BLUE_TEAM: "register-blue-team",
  CHECK_REGISTERED: "check-registered",
  RESET_REGISTERED: "reset-registered",
  SELECT_FEEDBACK_TYPE: "select-feedback-type",
  SUBMIT_FEEDBACK: "submit-feedback",
  OPEN_MODAL_TIMER: "open-modal-timer",
  SUBMIT_TIMER: "submit-timer",
  // 動作確認用
  TEST_DEVELOP_BUTTON: { ONE: "test-develop-button-1", TWO: "test-develop-button-2", THREE: "test-develop-button-3", FOUR: "test-develop-button-4", FIVE: "test-develop-button-5" },
}

// https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object-interaction-type
export const DISCORD_INTERACTION_TYPE = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3, // ボタンクリックとか
  APPLICATION_COMMAND_AUTOCOMPLETE: 4,
  MODAL_SUBMIT: 5,
}
