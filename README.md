# Input Studio Custom UI

Input Studio（デスクトップ版）の UI カスタマイズを個人用にバックアップするリポジトリです。

**Private リポジトリ推奨**（個人利用・バックアップ目的）

## 含まれる機能（`.cursor` 版）

- バインダー：書類のゴミ箱・復元
- バインダー：ページ単位のゴミ箱移動・復元
- PDF：複数ページ選択削除（1回最大10ページ）
- バインダー：元ページ番号・枚数の維持（`original_pages`）
- 論理ページ番号（PDF削除後もバインダー表示をずらさない）

## 使い方（反映）

1. Input Studio を終了
2. このリポジトリの `ui/` を、使用中の Input Studio の `_internal/ui/` に上書きコピー

```
コピー元: ui\
コピー先: （Input Studio フォルダ）\_internal\ui\
```

例（`.cursor` 版）:

```
C:\Users\SASAN\.cursor\_internal\ui\
```

3. `InputStudio.exe` を再起動

## 構成

```
ui/
  app.js              … メイン UI ロジック
  styles.css
  index.local.html    … ローカル(EXE)用エントリ
  i18n.js
  locales/            … 翻訳（ja.json / en.json ほか）
```

## 注意

- **EXE 本体（Python バックエンド）は含みません。** UI（フロントエンド）のみです。
- 業務データ（`project.json`、PDF、ZIP）は Git に含めないでください。
- 元の Input Studio の利用規約・ライセンスを確認のうえ、個人バックアップの範囲で利用してください。

## 変更履歴

- 2026-08: ゴミ箱、ページ単位削除/復元、元ページ番号維持
