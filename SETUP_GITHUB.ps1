#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$RepoDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Git = "C:\Program Files\Git\cmd\git.exe"
$Gh = "C:\Program Files\GitHub CLI\gh.exe"
$RepoName = "inputstudio-custom"

if (-not (Test-Path $Git)) {
  Write-Error "Git が見つかりません。Git for Windows をインストールしてください。"
}
if (-not (Test-Path $Gh)) {
  Write-Error "GitHub CLI (gh) が見つかりません。"
}

Write-Host "GitHub ログイン状態を確認..."
& $Gh auth status
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "先にログインしてください:"
  Write-Host "  & `"$Gh`" auth login"
  exit 1
}

Set-Location $RepoDir

Write-Host "Private リポジトリを作成して push します: $RepoName"
& $Gh repo create $RepoName --private --source=. --remote=origin --push --description "Input Studio custom UI (personal backup)"

if ($LASTEXITCODE -eq 0) {
  $url = & $Gh repo view --json url -q .url
  Write-Host ""
  Write-Host "完了しました!"
  Write-Host "リポジトリ: $url"
} else {
  Write-Host ""
  Write-Host "失敗しました。すでに同名リポジトリがある場合は、GitHub 上で削除するか別名に変更してください。"
  exit 1
}
