import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { WebhookSettingsSection } from "./WebhookSettingsSection"
import type { TeamWebhookView } from "@/app/_domains/teamSchedules/types"

const mockFetch = vi.fn<() => Promise<TeamWebhookView[]>>()
vi.mock("@/app/_domains/teamSchedules/_client/teamSchedulesApiClient", () => ({
  fetchTeamWebhooks: () => mockFetch(),
  updateTeamWebhooks: vi.fn(),
  sendWebhookTest: vi.fn(),
}))

const TEAM_ID = "123e4567-e89b-42d3-a456-426614174000"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("WebhookSettingsSection", () => {
  it("success: 未設定（空）でもクラッシュせず見出しと2枠を描画する", async () => {
    mockFetch.mockResolvedValue([])
    render(<WebhookSettingsSection teamId={TEAM_ID} isMaster={true} />)
    expect(screen.getByText("活動可能の通知（Discord）")).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByText("自分たち用")).toBeTruthy()
      expect(screen.getByText("相手も見るサーバー用")).toBeTruthy()
    })
  })

  it("failure: 取得失敗でもクラッシュせずエラー表示する", async () => {
    mockFetch.mockRejectedValue(new Error("通信失敗"))
    render(<WebhookSettingsSection teamId={TEAM_ID} isMaster={false} />)
    await waitFor(() => expect(screen.getByText("通信失敗")).toBeTruthy())
  })
})
