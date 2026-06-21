// ローカル開発ツール（drizzle-kit / seed スクリプト / infra スクリプト 等）用の env ローダー。
//
// 素の `import "dotenv/config"` は `.env` しか読まないため、`next dev` が読む
// `.env.local` 等に置いた値を拾えず、「seed/migrate は .env、dev は .env.local」と
// 接続先がズレる事故が起きる。ここでは next dev と同じ優先順位に揃える。
//
// 優先順位（高い方が勝つ）:
//   process.env（シェルの export / `VAR=x node ...` の CLI 指定）
//     > .env.development.local > .env.local > .env.development > .env
//
// dotenv はデフォルト（override なし）で「既に設定済みのキーは上書きしない」ため、
// 高い優先度のファイルから順に読み込めば、先に設定された値が残る。
// これにより (1) シェルで渡した値が常に勝つ＝スクリプトの `VAR=x node ...` 上書きを維持しつつ、
// (2) ファイル間では next dev と同じく .env.local が .env に勝つ、を両立する。
//
// 注意: dotenv のパス解決は process.cwd() 基準（モジュール位置ではない）。
// これらのツールは my-app 直下で実行する前提なので、相対パスはそこに解決される。
import { config } from "dotenv"

config({ path: ".env.development.local" })
config({ path: ".env.local" })
config({ path: ".env.development" })
config({ path: ".env" })
