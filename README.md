# TODO: READMEちゃんとする

## memo

サーバー：Vercel

- mainにpush, mergeで、本番へ自動デプロイ、コマンドをputで完全更新
- 非mainにpushでpreview(各ブランチ環境)へ自動デプロイ、guild commandに登録(差分をpost)  
  →コマンド調整は反映されないので注意
- 特にdevelopへpush, mergeでdiscord bot canary版に自動反映。discordサーバーのサンドボックスチャンネルでコマンドを試せる。
  気軽にpushして、動作確認して良い

※guild commandは即時反映、groval commandはコマンド登録の反映に最大1時間かかる
