import type { RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/v10"

export const WEBHOOK_STORAGE_KEY = "discord-webhook-url"

export async function sendWebhookMessage(webhookUrl: string, body: RESTPostAPIWebhookWithTokenJSONBody): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}
