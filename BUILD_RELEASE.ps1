#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Source = "C:\Users\SASAN\.cursor"
$StagingRoot = Join-Path $Root "_release_staging"
$AppDir = Join-Path $StagingRoot "InputStudio"
$Zip = Join-Path $Root "InputStudio-custom-win64.zip"

if (-not (Test-Path "$Source\InputStudio.exe")) {
  Write-Error "Source not found: $Source\InputStudio.exe"
}

Write-Host "Building release ZIP from: $Source"

if (Test-Path $StagingRoot) { Remove-Item -Recurse -Force $StagingRoot }
if (Test-Path $Zip) { Remove-Item -Force $Zip }

New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
Copy-Item "$Source\InputStudio.exe" "$AppDir\InputStudio.exe" -Force
Copy-Item -Recurse "$Source\_internal" "$AppDir\_internal" -Force

Write-Host "Compressing..."
Compress-Archive -Path $AppDir -DestinationPath $Zip -CompressionLevel Optimal -Force

Remove-Item -Recurse -Force $StagingRoot

$mb = [math]::Round((Get-Item $Zip).Length / 1MB, 2)
Write-Host "Done: $Zip ($mb MB)"
