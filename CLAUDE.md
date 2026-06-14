# LoL Custom Tool (Discord Bot)

## 常時読み込みルール

毎回の会話で必ず読み込まれます。

@.claude/rules/overview.md
@.claude/rules/coding-standards.md
@.claude/rules/setup.md
@.claude/rules/deployment.md
@.claude/rules/troubleshooting.md
@.claude/rules/feedback.md
@.claude/feedback/lessons.md

## オンデマンドルール

`.claude/rules-on-demand/` 配下のファイルは、作業内容に応じて参照してください。
常時読み込みではないため、**該当する作業をする前に必ず自分で読み込むこと**。

| ファイル | 内容 | 読み込むタイミング |
| --- | --- | --- |
| [discord-api.md](.claude/rules-on-demand/discord-api.md) | Discord API開発ルール・データ保存 | `app/api/discord/**` 編集時 |
| [web-api.md](.claude/rules-on-demand/web-api.md) | Web API・認証ルール | `app/api/web/**` 編集時 |
| [markdown.md](.claude/rules-on-demand/markdown.md) | Markdownlintルール | `**/*.md` 編集時 |
| [planning.md](.claude/rules-on-demand/planning.md) | 実行計画書の命名規則 | `VIBES/plan/**` 編集時 |
| [database.md](.claude/rules-on-demand/database.md) | PostgreSQL+Drizzle・ローカル/本番DB・確認方法 | DB/スキーマ/マイグレーション作業時 |
