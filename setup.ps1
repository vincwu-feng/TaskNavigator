<#
.SYNOPSIS
  Prepares a local TaskNavigator install: dependencies, data dir, and config.json.

.EXAMPLE
  .\setup.ps1 -InstallDeps
#>
param(
  [switch]$InstallDeps,
  [string]$DifyBaseUrl,
  [string]$DifyEvalKey
)

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$DataDir = Join-Path $Root 'data'
$ConfigPath = Join-Path $Root 'config.json'
$ExamplePath = Join-Path $Root 'config.example.json'

New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

if (-not (Test-Path -LiteralPath $ConfigPath)) {
  Copy-Item -LiteralPath $ExamplePath -Destination $ConfigPath
  Write-Host "Created config.json from config.example.json (mock mode)." -ForegroundColor Green
} else {
  Write-Host 'config.json already exists; leaving it untouched.'
}

if ($DifyBaseUrl -or $DifyEvalKey) {
  $cfg = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
  if ($DifyBaseUrl) { $cfg.dify.baseUrl = $DifyBaseUrl }
  if ($DifyEvalKey) {
    $cfg.dify.apiKeys.eval = $DifyEvalKey
    $cfg.dify.mock = $false
    $cfg.dify.fallbackToMock = $false
  }
  ($cfg | ConvertTo-Json -Depth 10) | Set-Content -LiteralPath $ConfigPath -Encoding utf8
  Write-Host 'Applied Dify settings to config.json.' -ForegroundColor Green
}

if ($InstallDeps) {
  Write-Host 'Installing dependencies (electron)...'
  Push-Location $Root
  try {
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
  } finally {
    Pop-Location
  }
}

Write-Host ''
Write-Host 'Setup complete.' -ForegroundColor Green
Write-Host 'TaskNavigator only reads the local session logs of sessions you explicitly bind.'
Write-Host 'No Codex hook configuration is required.'
Write-Host ''
Write-Host 'Next:'
Write-Host '  1. node daemon\index.js        # start the backend'
Write-Host '  2. .\start-local.cmd           # start the desktop dock'