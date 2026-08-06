# GitHub へアップロード（初回だけ）

## 1. GitHub にログイン（1回だけ）

PowerShell で実行:

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" auth login
```

表示に従って:

- GitHub.com
- HTTPS
- Login with a web browser（ブラウザで認証）

## 2. このスクリプトを実行

```powershell
cd C:\Users\SASAN\Documents\inputstudio-custom
powershell -ExecutionPolicy Bypass -File .\SETUP_GITHUB.ps1
```

Private リポジトリ `inputstudio-custom` が作成され、コードが push されます。

---

## 手動でやる場合

1. https://github.com/new で **Private** リポジトリ `inputstudio-custom` を作成（README は追加しない）
2. 以下を実行:

```powershell
cd C:\Users\SASAN\Documents\inputstudio-custom
& "C:\Program Files\Git\cmd\git.exe" branch -M main
& "C:\Program Files\Git\cmd\git.exe" remote add origin https://github.com/あなたのユーザー名/inputstudio-custom.git
& "C:\Program Files\Git\cmd\git.exe" push -u origin main
```

## リポジトリの場所

`C:\Users\SASAN\Documents\inputstudio-custom`
