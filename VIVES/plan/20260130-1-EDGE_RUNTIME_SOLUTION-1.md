# Edge Runtime + waitUntil による解決

## 問題

サーバーレス環境（Vercel）では：
- レスポンスを返すと関数が終了する
- Web APIの完了を`await`すると、Discord の 3秒制限に引っかかる
- `await`しないと、HTTPリクエストが送信される前に関数が終了する

## 解決策: Edge Runtime + waitUntil

Vercel の Edge Runtime には `waitUntil` API があり、**レスポンスを返した後も処理を継続できます**。

### 変更点

1. **Edge Runtime を有効化**
   ```typescript
   export const runtime = 'edge'
   ```

2. **waitUntil で処理を継続**
   ```typescript
   const apiCall = fetch(...).then(...).catch(...)
   
   // レスポンスを返した後も処理を継続
   if ('waitUntil' in req) {
     (req as any).waitUntil(apiCall)
   }
   
   // すぐにレスポンスを返す
   return NextResponse.json({ type: 5 })
   ```

### 動作フロー

1. モーダル送信（ユーザー）
2. `fetch` で Web API を呼び出し開始
3. `waitUntil` に Promise を渡す
4. **即座に DEFERRED レスポンスを返す**（< 100ms）
5. Discord が「考え中...」を表示
6. **バックグラウンドで Web API が完了**（1〜2秒）
7. Web API が Discord Webhook を送信
8. Discord にメッセージが表示される

## Edge Runtime の制約

Edge Runtime では Node.js 固有の API が使えません：
- ❌ `fs`, `crypto`, `buffer` など
- ✅ Web 標準 API（fetch, Web Crypto API など）

### discord-interactions の互換性

`discord-interactions` の `verifyKey` は Node.js の `crypto` を使っている可能性があります。

**もしデプロイ時にエラーが出た場合：**

```
Error: The edge runtime does not support Node.js 'crypto' module.
```

この場合は、Web Crypto API を使った検証に書き換える必要があります。

## デプロイ手順

1. **修正した route.ts を適用**
   ```bash
   # route.ts の先頭に追加
   export const runtime = 'edge'
   ```

2. **デプロイ**
   ```bash
   git add .
   git commit -m "Use Edge Runtime with waitUntil"
   git push
   ```

3. **動作確認**
   - モーダルを送信
   - 「考え中...」が即座に表示される
   - 1〜2秒後にメッセージが表示される

4. **ログ確認**
   Vercel のログで以下が出力されるはず:
   ```
   Saving red team data for matchId: xxx
   Web API call initiated for red team
   Processing red team registration for match xxx  ← Web APIのログ
   Successfully saved red team data to Redis
   Successfully sent Discord message
   ```

## エラーが出た場合の対応

### Case 1: discord-interactions が Edge Runtime で動かない

**エラー:**
```
Error: The edge runtime does not support Node.js 'crypto' module.
```

**対応:** Web Crypto API で署名検証を実装する必要があります。その場合は連絡してください。

### Case 2: Redis が Edge Runtime で動かない

**エラー:**
```
Error: Cannot find module 'net'
```

**対応:** Redis ライブラリを Edge 対応のものに変更する必要があります（@upstash/redis など）。

### Case 3: waitUntil が使えない

**エラー:**
```
req.waitUntil is not a function
```

**対応:** Vercel 以外の環境では `waitUntil` が使えない可能性があります。別の方法を検討します。

## 代替案（Edge Runtime が使えない場合）

もし Edge Runtime でエラーが出る場合は、以下の方法があります：

### 方法1: Web API を Queue/Worker に分離
- Vercel Cron Jobs
- Redis Queue（BullMQ等）
- 外部サービス（Inngest, Trigger.dev等）

### 方法2: 別のホスティングサービス
- Railway（永続的なプロセス）
- Render（Background Workers）
- Fly.io（Long-running processes）

### 方法3: Discordの仕様に合わせた実装
実は、現在の実装でも動く可能性があります：
- fetchは開始された時点でHTTPリクエストの送信を試みる
- Node.js Runtimeでは、レスポンス後も数秒は処理が継続される（非保証）
- 運が良ければ動く

## まとめ

**推奨：** まずは Edge Runtime 版を試す
- 最もシンプルで確実な方法
- Vercel の公式機能
- エラーが出たら、その時に対応

**次のステップ：**
1. デプロイ
2. 動作確認
3. エラーが出たら連絡
