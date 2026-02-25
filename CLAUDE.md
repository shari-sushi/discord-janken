# LoL Custom Tool (Discord Bot)

詳細なルールは `.claude/rules/` 配下のファイルを参照してください。

## 常時読み込み

@.claude/rules/overview.md
@.claude/rules/coding-standards.md
@.claude/rules/setup.md
@.claude/rules/deployment.md
@.claude/rules/troubleshooting.md

## 作業内容に応じて参照するルール

| ファイル | 内容 | 適用タイミング |
| --- | --- | --- |
| [discord-api.md](.claude/rules/discord-api.md) | Discord API開発ルール・データ保存 | `app/api/discord/**` 編集時 |
| [web-api.md](.claude/rules/web-api.md) | Web API・認証ルール | `app/api/web/**` 編集時 |
| [markdown.md](.claude/rules/markdown.md) | Markdownlintルール | `**/*.md` 編集時 |
| [planning.md](.claude/rules/planning.md) | 実行計画書の命名規則 | `VIBES/plan/**` 編集時 |
