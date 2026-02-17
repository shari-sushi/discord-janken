# デプロイガイド

## デプロイ設定

- **プラットフォーム**: Vercel
- **自動デプロイ**: main ブランチへのプッシュで自動デプロイ
- **コマンド登録**:
  - ビルド時に `VERCEL_ENV=production` の場合のみ自動実行
  - ローカルで即時実行したい場合は `npx tsx app/api/discord/register-commands.ts`

## 注意事項

- **ビルド時のコマンド上書き注意**: 本番環境（`VERCEL_ENV=production`）でビルドすると自動的にDiscordコマンドが上書き登録される
