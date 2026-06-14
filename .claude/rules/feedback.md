# フィードバックシステム

AIのミスや改善点を蓄積・学習するための仕組みです。

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| [feedback/log.md](../feedback/log.md) | ユーザーが指摘したAIのミスを時系列で記録（append-only） |
| [feedback/lessons.md](../feedback/lessons.md) | log.md から蒸留したパターン化された教訓（常時読み込み） |

## log.md への記録ルール

ユーザーからミスの指摘を受けたとき、**会話終了前に必ず** `log.md` に追記してください。

```markdown
## YYYY-MM-DD: [ミスのタイトル]

**カテゴリ**: design / code-quality / architecture / ux / process / other
**状況**: どんな作業をしていたか
**ミス**: 何をやってしまったか
**正解**: 何をすべきだったか
```

## lessons.md への蒸留ルール

`log.md` に**同じカテゴリのミスが3件以上**蓄積したとき、パターンを抽出して `lessons.md` に追記し、
該当エントリに `[distilled]` タグをつけてください。
