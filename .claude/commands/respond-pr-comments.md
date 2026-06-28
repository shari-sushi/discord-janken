---
description: 指定 PR の新規コメントを5分ごと最大1時間ポーリングし、必要なコミットを全てプッシュしてから各指摘に返信する（不要な指摘には理由つきで「不要」と返す）
argument-hint: "<PR番号>（省略時はカレントブランチの PR を自動判定。例: 216）"
allowed-tools: Bash, Read, Grep, Glob, Edit, Write, Agent, Skill
---

# PR コメント待機 → 対応（コミット＋返信）

指定した PR に**新しいコメントが付くまで待機**し、付いたら各指摘へ対応する。
対応とは「**必要なコードはコミットして push し、その後で各コメントに返信する**」こと。
指摘は必ず実行するものではなく、**不要なものには理由を添えて「不要」と返信**する。

対象 PR 番号: $ARGUMENTS

## 前提・パラメータ

- **ポーリング間隔**: 5分（300秒）ごと
- **最大待機時間**: 1時間（= 最大12回ポーリング）
- 1時間経っても新規コメントが無ければ、その旨を報告して終了する。
- **PR が close / merge されていたら、その時点で監視を終了し、あなたの作業も終了する**
  （以降の対応・返信は行わない。close 済みの PR にコメントしても無意味なため）。
- `gh` はカレントディレクトリから owner/repo を自動判定する（`{owner}`/`{repo}` は gh が置換）。
- **鉄則（CLAUDE.md）**: `develop` への直 push は禁止。force-push も禁止。修正は必ず feature ブランチに対して行う。

## 進め方

### 1. PR 番号を確定する

- `$ARGUMENTS` に数字があればそれを使う。
- 無い場合は `gh pr view --json number --jq .number`（カレントブランチの PR）で自動判定する。
- 判定できなければユーザーに PR 番号を尋ねて中断する。
- `gh pr view <PR> --json number,headRefName,baseRefName,state` を取得しておく。
  - **head が `develop` / `main` などの保護ブランチの場合**（例: develop→main の release PR）は、後述の「保護ブランチ運用」に従う。

### 2. 新規コメントをポーリングする（バックグラウンド実行）

以下を **`run_in_background: true`** で実行する。スクリプト開始時点のコメントを
baseline として記録し、5分ごとに最大12回、baseline 後に増えた**自分以外**の
コメントを探す。見つかれば種別と ID を出力して exit 0、タイムアウトで exit 1。

コメントは3経路すべてを対象にする:
- issue comments（PR 全体への一般コメント）
- review comments（コード行へのインラインコメント）
- reviews（レビュー本文。CodeRabbit / Copilot 等の bot もここに出す）

```bash
PR=<PR番号>
BASE="$TMPDIR/pr_${PR}_seen.txt"   # baseline 保存先（スクラッチパッドでも可）
# 対応不要なノイズ bot だけを無視（カンマ区切り）。デプロイ通知など。
# 注意: 自分の gh アカウントは除外しない（後述）。
IGNORE_AUTHORS="vercel[bot]"

collect_ids() {
  gh api "repos/{owner}/{repo}/issues/$PR/comments" --paginate \
    --jq '.[] | "ic:\(.id):\(.user.login)"' 2>/dev/null
  gh api "repos/{owner}/{repo}/pulls/$PR/comments" --paginate \
    --jq '.[] | "rc:\(.id):\(.user.login)"' 2>/dev/null
  gh api "repos/{owner}/{repo}/pulls/$PR/reviews" --paginate \
    --jq '.[] | select(.body != "") | "rv:\(.id):\(.user.login)"' 2>/dev/null
}

# 開始時点に存在するコメントを baseline として記録（これらは「新規」扱いしない）
collect_ids | cut -d: -f1,2 | sort -u > "$BASE"

for i in $(seq 1 12); do
  # PR が close / merge されていたら監視終了（state が OPEN 以外なら抜ける）
  STATE=$(gh pr view "$PR" --json state --jq .state 2>/dev/null)
  if [ "$STATE" != "OPEN" ]; then
    echo "PR_CLOSED: state=$STATE"
    exit 2
  fi

  NEW=$(collect_ids | while IFS=: read -r typ id login; do
          key="$typ:$id"
          # baseline（開始時点スナップショット）に在れば既知なのでスキップ
          grep -qxF "$key" "$BASE" && continue
          # 対応不要なノイズ bot はスキップ
          case ",$IGNORE_AUTHORS," in *",$login,"*) continue ;; esac
          # それ以外は作者を問わず「新規」とする（自分の gh アカウントの投稿も含む）
          echo "$key by $login"
        done)
  if [ -n "$NEW" ]; then
    echo "NEW_COMMENTS:"
    echo "$NEW"
    exit 0
  fi
  echo "attempt $i/12: no new comments yet"
  [ "$i" -lt 12 ] && sleep 300
done
echo "TIMEOUT: no new comments within 1 hour"
exit 1
```

- **作者で除外しない（重要）**: このリポジトリでは人間のレビューも・別 Claude セッションのレビューも・自分の返信も、すべて同じ gh アカウントで投稿される。よって「自分のアカウントを除外」すると正当なレビューまで握りつぶす。除外するのは `IGNORE_AUTHORS` のノイズ bot だけにする。
- **返信ループ防止は baseline（開始時点スナップショット）で担保する**: 検出したら対応して終了し、同一 run 内では再ポーリングしない。再監視時は自分の過去の返信も baseline に入るため新規扱いされない。
- スクリプト終了時に再度呼び出されるので、ポーリング中は他作業を続けてよい。

### 3. 結果に応じて分岐する

- **`PR_CLOSED: state=...`**: PR が close / merge された。「PR が close 済みのため監視を終了する」と報告し、**以降の対応・返信は行わず作業を終了する**。
- **`TIMEOUT`**: 「1時間以内に新規コメントは無かった」と報告して終了。
- **`NEW_COMMENTS:`**: 出力された種別:ID の本文を取得して対応へ進む。
  - issue comment: `gh api repos/{owner}/{repo}/issues/comments/<id>`
  - review comment（インライン）: `gh api repos/{owner}/{repo}/pulls/comments/<id>`（`path` `line` `diff_hunk` `in_reply_to_id` も見る）
  - review 本文: `gh api repos/{owner}/{repo}/pulls/<PR>/reviews/<id>`
  - bot（CodeRabbit/Copilot 等）の場合、サマリ内に複数指摘が箇条書きされることがある。**1コメント＝1指摘とは限らない**ので本文を精読して指摘を粒度ごとに分解する。

### 4. 各指摘をトリアージする

指摘ごとに3分類する。**必ず実行する必要はない**ことを前提に判断する。

- **要修正**: 妥当な指摘。コードを直す。
- **不要（却下）**: 誤解・スコープ外・既存仕様・トレードオフ上あえてそうしている等。**理由を添えて「不要」と返信**する（黙って無視しない）。
- **質問・確認**: 回答コメントを返す。仕様判断を伴い迷うものは勝手に決めず、ユーザーに確認する。

### 5. 先にコミットを全て push する（返信より前）

**重要**: コメントを返す前に、要修正分の**コミットを全て push し終えておく**こと。
「対応しました」と返信した後でまだ未 push、という状態を作らない。

1. 直す PR の **head ブランチ**にローカルを合わせる（`git fetch origin <head>` → checkout）。
2. コードを修正する。
3. **品質チェック（CLAUDE.md / coding-standards）**:
   - `npm run lint`（`my-app/` で実行）でエラー・警告ゼロ
   - `npx tsc --noEmit` で型エラーゼロ
   - 環境変数を増減した場合は `.claude/rules/setup.md` の一覧を更新
4. 指摘ごと／論理単位でコミットする。コミットメッセージ末尾に必ず:

   ```txt
   Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
   ```

5. head ブランチへ push する。**`develop` には push しない**。

#### 保護ブランチ運用（head が develop / main の release PR の場合）

release PR（develop→main 等）に修正指摘が来た場合、**release PR の head（develop）へ直接 push してはいけない**。

- 新しい feature ブランチを `develop` から切る → 修正・コミット → push → **feature→develop の PR** を作る。
- 元の release PR にはその旨（「修正は #<新PR> で develop に入れます。マージ後この release PR に反映されます」）を返信する。
- どのルートで直すか迷う場合はユーザーに確認する。

### 6. 各コメントに返信する

push 完了後に返信する。**全ての指摘に何らかの返信を返す**（対応・不要・回答のいずれか）。

- **インライン review comment への返信**（スレッドにぶら下げる）:

  ```bash
  gh api repos/{owner}/{repo}/pulls/<PR>/comments/<comment_id>/replies -f body="..."
  ```

- **一般コメント / review 本文への返信**: `gh pr comment <PR> --body "..."`

返信の型:
- 対応した: 「対応しました。<コミットSHA> で <何をどう直したか>」
- 不要（却下）: 「これは対応不要と判断しました。理由: <根拠>」（誤解なら丁寧に訂正、トレードオフならそれを明示）
- 回答: 質問への答え。

返信文は CLAUDE.md の方針（採らなかった代替案＋却下理由まで先回りで書く）に沿わせる。

### 7. 仕上げ

- 対応サマリ（要修正 N 件 / 不要 M 件 / 回答 K 件、push したコミット、関連 PR）をユーザーに報告する。
- レビュー指摘で「セルフレビューで先回りできたはずのもの」があれば `review-retro` スキルの実行を提案する。

## 注意

- ネットワーク/認証エラーで `gh` が失敗した場合は、リトライを続けず原因を報告する。
- 同じスレッドに既に自分が返信済みの指摘へ二重返信しない（baseline + 自分除外で基本防げるが、本文取得時にも確認する）。
- 破壊的操作（force-push、reset）は行わない。必要に見えても必ずユーザーに確認する。
