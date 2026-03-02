import { Client } from "@upstash/qstash"
import { QSTASH_TOKEN } from "../env"

const qstashClient = new Client({
  token: QSTASH_TOKEN,
})

/**
 * QStash で指定時刻にコールバックURLを呼び出すスケジュールを登録する
 * @param url - コールバック先URL
 * @param body - 送信するペイロード
 * @param notBefore - 実行時刻（Unix timestamp 秒）
 */
export const qstashPublishJSON = async (url: string, body: unknown, notBefore: number): Promise<void> => {
  await qstashClient.publishJSON({ url, body, notBefore })
}
