-- スクリム調整アプリ DDL (PostgreSQL)
-- 前提: PostgreSQL 13+（gen_random_uuid() が標準で使える / Neon 等でOK）
-- これは「作り直し」用のフル定義。既存環境に流すなら DROP は各自で。

-- 状態系の値は text + CHECK で表現（ENUMより値の増減がしやすい）-------
-- CHECK制約には名前を付けておくと、後で値を足すときの ALTER が楽：
--   ALTER TABLE schedules DROP CONSTRAINT schedules_status_chk;
--   ALTER TABLE schedules ADD  CONSTRAINT schedules_status_chk CHECK (status IN (...));
-- 「未記入」は行が無い状態で表現する（status に 'none' は持たせない）

-- teams: チーム（自チームも相手チームも全部ここに入れる） -----------
CREATE TABLE teams (
    team_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- UUIDv4
    name           text NOT NULL,
    description    text,
    -- 「活動可能」と判定するのに必要な ok の人数。自チーム=5, 相手チーム=1 を作成時に設定
    required_count integer NOT NULL DEFAULT 5 CHECK (required_count >= 1),
    created_at     timestamptz NOT NULL DEFAULT now()
);

-- users: ログインする人（複数チームに所属しうるのでチームは持たせない） -
CREATE TABLE users (
    user_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- UUIDv4
    display_name  text NOT NULL,        -- 重複OK（ログインは一覧から選んで解決）
    password_hash text NOT NULL,        -- bcrypt。平文は絶対に入れない
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- team_members: 所属(M:N) + ロール ------------------------------------
--   「誰がどのチームの管理者か」もここで表現する
--   相手チームは、相手admin を A・B 両方の member(role=admin) として入れる
--   → 1アカウントで A/B 両方を編集、が自然に成立する
CREATE TABLE team_members (
    team_id   uuid NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
    user_id   uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    -- アプリ内の権限ロール（個人 / 管理者）
    team_role text NOT NULL DEFAULT 'individual'
                  CONSTRAINT team_members_team_role_chk CHECK (team_role IN ('individual', 'admin')),
    -- このチームで担当できるLoLロール（can-play の有無）。固定5種なので bool 5列
    top     boolean NOT NULL DEFAULT false,
    jungle  boolean NOT NULL DEFAULT false,
    mid     boolean NOT NULL DEFAULT false,
    adc     boolean NOT NULL DEFAULT false,
    support boolean NOT NULL DEFAULT false,
    -- ※ 優先順・得意度・レート等は別concern（行ごとに値を持つ）。やるなら将来
    --   member_role_details(team_id, user_id, lol_role, priority, proficiency, rating ...)
    --   を別テーブルで。本職(初期値seed)もそこ or users 側に後付け可能。
    joined_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (team_id, user_id)
);
CREATE INDEX idx_team_members_user ON team_members (user_id);  -- 「この人の所属チーム一覧」用

-- schedules: 予定（1日1行）。状態を付けた時だけ INSERT ----------------
--   未記入 = 行が無い
--   複合PK (team_id, user_id, day) → 同じ人が複数チームでも別行で持てる
--   (team_id, user_id) は実在する所属でなければならない → team_members へ複合FK
CREATE TABLE schedules (
    team_id    uuid NOT NULL,
    user_id    uuid NOT NULL,
    day        date NOT NULL,
    status     text NOT NULL
                   CONSTRAINT schedules_status_chk CHECK (status IN ('ok', 'maybe', 'ng')),
    note       text,                    -- 自由記入の時間/コメント (例: "21:00~")
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (team_id, user_id, day),
    FOREIGN KEY (team_id, user_id)
        REFERENCES team_members (team_id, user_id) ON DELETE CASCADE
);
CREATE INDEX idx_schedules_team_day ON schedules (team_id, day);  -- 集計クエリ用

-- discord_links: 1アプリアカウント : N Discordアカウント --------------
--   bot が「Discord発言者ID → アプリアカウント」を逆引きできるよう
--   discord_user_id を主キーに（1つのDiscordは1ユーザにのみ紐づく）
CREATE TABLE discord_links (
    discord_user_id text PRIMARY KEY,    -- Discordのsnowflake。textで持つのが安全
    user_id         uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    linked_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_discord_links_user ON discord_links (user_id);  -- 「この人のDiscord一覧」用


-- 集計・成立判定はDBに持たせない -------------------------------------
-- グリッド表示にはどのみち生の行（各メンバーの status）が要るので、
-- 必要範囲を SELECT で取って、○数・成立・詰みは「フロントで都度算出」する。
--   例: SELECT * FROM schedules WHERE team_id = $1 AND day BETWEEN $2 AND $3;
-- VIEW / MATERIALIZED VIEW は規模的に不要。Redisも今は不要（実測でボトルネックが
-- 出たら read-through キャッシュとして足す）。
-- 詰み判定に使う「所属人数」は team_members から取る
--   （未記入は schedules に行が無いので、schedules の件数では人数を測れない）。


-- 古い行の掃除（任意・Vercel Cron 等から定期実行） --------------------
-- 規模的に性能目的では不要。整理用途。
--   DELETE FROM schedules WHERE day < CURRENT_DATE - INTERVAL '30 days';
