#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$RepoDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Git = "C:\Program Files\Git\cmd\git.exe"
$Gh = "C:\Program Files\GitHub CLI\gh.exe"
$RepoName = "inputstudio-custom"

if (-not (Test-Path $Git)) {
  Write-Error "Git not found. Install Git for Windows."
}
if (-not (Test-Path $Gh)) {
  Write-Error "GitHub CLI (gh) not found."
}

Write-Host "Checking GitHub login..."
& $Gh auth status
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Please login first:"
  Write-Host "  & `"$Gh`" auth login"
  exit 1
}

Set-Location $RepoDir

Write-Host "Creating private repo and pushing: $RepoName"
& $Gh repo create $RepoName --private --source=. --remote=origin --push --description "Input Studio custom UI (personal backup)"

if ($LASTEXITCODE -eq 0) {
  $url = & $Gh repo view --json url -q .url
  Write-Host ""
  Write-Host "Done!"
  Write-Host "Repository: $url"
} else {
  Write-Host ""
  Write-Host "Failed. If the repo name already exists, delete it on GitHub or choose another name."
  exit 1
}
