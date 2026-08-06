#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$RepoDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Git = "C:\Program Files\Git\cmd\git.exe"
$Gh = "C:\Program Files\GitHub CLI\gh.exe"
$RepoName = "inputstudio-custom"

if (-not (Test-Path $Git)) { Write-Error "Git not found." }
if (-not (Test-Path $Gh)) { Write-Error "GitHub CLI (gh) not found." }

Write-Host "Checking GitHub login..."
& $Gh auth status
if ($LASTEXITCODE -ne 0) {
  Write-Host "Run: & `"$Gh`" auth login"
  exit 1
}

Set-Location $RepoDir

$existing = & $Gh repo view "TomohikoSASANO/$RepoName" 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Creating private repo: $RepoName"
  & $Gh repo create $RepoName --private --description "Input Studio custom UI (personal backup)"
  if ($LASTEXITCODE -ne 0) { exit 1 }
}

& $Git remote remove origin 2>$null
& $Git remote add origin "https://github.com/TomohikoSASANO/$RepoName.git"
Write-Host "Pushing to GitHub..."
& $Git push -u origin main

if ($LASTEXITCODE -eq 0) {
  Write-Host "Done: https://github.com/TomohikoSASANO/$RepoName"
} else {
  exit 1
}
