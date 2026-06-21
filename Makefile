# team_schedules（スクリム調整機能）のローカル動作確認用 Makefile
#
# docker-compose.yml はこのディレクトリ、npm スクリプトは my-app/ で動く。
# 各ターゲットは内部で `cd my-app` を行うのでリポジトリルートで実行すればよい。
#
# よく使う流れ:
#   make verify   # DB/Redis 起動 → migrate → seed → ログインURL発行（初回はこれ1発）
#   make dev      # 別ターミナルで dev サーバー起動
#   出力された magic-link URL をブラウザで開いてログイン
#
# トークンが切れたら `make login` で再発行（seed はやり直さない）。

APP_DIR := my-app
COMPOSE := docker compose

# シェルに残った export（例: `export DATABASE_URL=...`）は Next も dotenv も上書きしないため、
# .env.local より優先されてしまい「dev だけ別 DB を掴む」事故が起きる。
# ローカルの make では接続文字列をシェルから剥がし、必ず .env/.env.local を使わせる。
LOCAL_ENV := env -u DATABASE_URL -u REDIS_URL

.DEFAULT_GOAL := help

.PHONY: help db-up db-down logs migrate seed login creator-login dev run db-run studio psql verify reset

help: ## このヘルプを表示
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

db-up: ## DB + Redis を起動（healthy になるまで待つ）
	$(COMPOSE) up -d --wait db redis

db-down: ## DB + Redis を停止（データは pgdata/redis_data に残る）
	$(COMPOSE) stop db redis

logs: ## DB + Redis のログを追う
	$(COMPOSE) logs -f db redis

migrate: ## マイグレーションを適用（.env.local の DATABASE_URL 先）
	cd $(APP_DIR) && $(LOCAL_ENV) npm run db:migrate

seed: ## テストチーム・メンバー・予定を投入し、ログインURLを発行（MEMBERS=10 で一般メンバーを追加生成）
	cd $(APP_DIR) && $(LOCAL_ENV) EXTRA_MEMBERS=$(MEMBERS) npm run seed:team-schedules

login: ## seed せず magic-link ログインURLだけ再発行（トークン失効時。MEMBERS は seed 時と同じ値を指定）
	cd $(APP_DIR) && $(LOCAL_ENV) EXTRA_MEMBERS=$(MEMBERS) node scripts/team-schedules/seed-team-schedules.mjs --login-only

creator-login: ## TEAM_SCHEDULE_CREATOR_DISCORD_IDS のユーザー分のログインURLを発行
	cd $(APP_DIR) && $(LOCAL_ENV) npm run creator-login:team-schedules

dev: ## dev サーバーを起動（http://localhost:3000）
	cd $(APP_DIR) && $(LOCAL_ENV) npm run dev

run: db-up ## Redis + Postgres を起動してから dev サーバーを起動（これ1発で動作確認）
	cd $(APP_DIR) && $(LOCAL_ENV) npm run dev

db-run: db-up ## Redis + Postgres だけ起動（dev サーバーは起動しない）

studio: ## Drizzle Studio で DB の中身を確認
	cd $(APP_DIR) && $(LOCAL_ENV) npm run db:studio

psql: ## ローカル DB に psql で接続
	docker exec -it discord-janken-db psql -U postgres -d team_schedules

verify: db-up migrate seed ## 動作確認の初期セットアップ一括（db-up → migrate → seed）
	@echo ""
	@echo "✅ セットアップ完了。別ターミナルで 'make dev' を実行し、上の magic-link URL を開いてください。"

reset: ## DB/Redis を破棄して作り直す（pgdata/redis_data ごと削除・破壊的）
	$(COMPOSE) down -v
	$(MAKE) verify
