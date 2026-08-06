# Input Studio Custom（個人用）

カスタム機能入り Input Studio の個人バックアップ＆配布用リポジトリです（Private 推奨）。

## 別PCですぐ使う（おすすめ）

1. GitHub にログインした状態で **[Releases](https://github.com/TomohikoSASANO/inputstudio-custom/releases)** を開く
2. 最新の **`InputStudio-custom-win64.zip`** をダウンロード
3. ZIP を好きな場所に解凍（例: `C:\Tools\InputStudio\`）
4. 解凍フォルダ内の **`InputStudio.exe`** を起動

解凍後の構成:

```
InputStudio/
  InputStudio.exe
  _internal/
    ui/          … カスタム UI 込み
    …
```

**そのまま動きます。** UI の上書きコピーは不要です。

## 含まれるカスタム機能

- バインダー：書類のゴミ箱・復元
- バインダー：ページ単位のゴミ箱移動・復元
- PDF：複数ページ選択削除（1回最大10ページ）
- バインダー：元ページ番号・枚数の維持
- 論理ページ番号（PDF削除後もバインダー表示をずらさない）

## 開発者向け：UI だけ更新する場合

リポジトリの `ui/` を、既存インストールの `_internal/ui/` に上書き:

```
ui\  →  （Input Studio フォルダ）\_internal\ui\
```

## リリース ZIP の再作成（この PC）

```powershell
powershell -ExecutionPolicy Bypass -File .\BUILD_RELEASE.ps1
& "C:\Program Files\GitHub CLI\gh.exe" release upload v1.0.0 InputStudio-custom-win64.zip --clobber
```

ソースの正本（コピー元）: `C:\Users\SASAN\.cursor\`

## 注意

- Windows 64bit 用です
- 業務データ（`project.json`、PDF、ZIP）は Git に含めないでください
- 個人利用・バックアップの範囲で利用してください

## 変更履歴

- **v1.0.0** (2026-08): 初回リリース（EXE + `_internal` 同梱 ZIP）
