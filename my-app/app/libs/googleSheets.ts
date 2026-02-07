import { google } from "googleapis"

// Google Sheets APIの認証
const getAuth = () => {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!credentials) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set")
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentials),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })

  return auth
}

// スプレッドシートIDを取得
const getSpreadsheetId = () => {
  const url = process.env.GOOGLE_SHEET_URL
  if (!url) {
    throw new Error("GOOGLE_SHEET_URL is not set")
  }

  // URLからスプレッドシートIDを抽出
  // https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit...
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) {
    throw new Error("Invalid Google Sheet URL")
  }

  return match[1]
}

type FeedbackData = {
  guildId: string
  memberId?: string
  name?: string
  type: string
  content: string
}

// フィードバックをGoogle Sheetsに追加
export const appendFeedbackToSheet = async (data: FeedbackData) => {
  try {
    const auth = await getAuth()
    const sheets = google.sheets({ version: "v4", auth })
    const spreadsheetId = getSpreadsheetId()

    // シート名
    const sheetName = "FeedBack"

    // 追加するデータ（B列から開始）
    const values = [[data.guildId, data.memberId || "", data.name || "", data.type, data.content]]

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!B3`, // B列の3行目から追加
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values,
      },
    })

    return response.data
  } catch (error) {
    console.error("Error appending to Google Sheet:", error)
    throw error
  }
}
