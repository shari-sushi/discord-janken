export const COMMAND_PREF = "lol-"

export const COMMANDS = {
  ECHO: COMMAND_PREF + "echo",
  NEW_PROTECT: COMMAND_PREF + "new-protect",
}

export const CLIENT_ACTIONS = {
  OPEN_MODAL_RED_TEAM_REGISTER: "open-modal-red-team-register",
  OPEN_MODAL_BLUE_TEAM_REGISTER: "open-modal-blue-team-register",
  REGISTER_RED_TEAM: "register-red-team-register",
  REGISTER_BLUE_TEAM: "register-blue-team",
  CHECK_REGISTERED: "check-registered",
}

// https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object-interaction-type
export const DISCORD_INTERACTION_TYPE = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3, // ボタンクリックとか
  APPLICATION_COMMAND_AUTOCOMPLETE: 4,
  MODAL_SUBMIT: 5,
}
