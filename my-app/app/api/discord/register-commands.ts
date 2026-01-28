import "dotenv/config"

const DISCORD_TOKEN = process.env.DISCORD_TOKEN!
const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID!

const command = {
  name: "submit",
  description: "同時発言に参加",
  options: [
    {
      name: "message",
      description: "発言内容",
      type: 3,
      required: true,
    },
  ],
}

fetch(`https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`, {
  method: "POST",
  headers: {
    Authorization: `Bot ${DISCORD_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(command),
})
  .then((res) => res.json())
  .then(console.log)
