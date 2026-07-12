# Windows 发版入口：调用 Git Bash 执行 release.sh
# 用法: .\scripts\release.ps1 patch
#       .\scripts\release.ps1 -y patch
#       .\scripts\release.ps1 patch --dry-run

param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ReleaseArgs
)

$ErrorActionPreference = "Stop"

$bashCandidates = @(
  "$env:ProgramFiles\Git\bin\bash.exe",
  "$env:ProgramFiles\Git\usr\bin\bash.exe"
)
$bash = $bashCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $bash) {
  throw "未找到 Git Bash。请安装 Git for Windows: https://git-scm.com/download/win"
}

$root = git -C (Join-Path $PSScriptRoot "..") rev-parse --show-toplevel 2>$null
if (-not $root) {
  $root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

$rootPosix = ($root -replace '\\', '/')
$escaped = ($ReleaseArgs | ForEach-Object { "'$($_ -replace "'", "'\\''")'" }) -join ' '
$cmd = "cd '$rootPosix' && ./scripts/release.sh $escaped"

Write-Host "==> Git Bash: $cmd"
& $bash -c $cmd
exit $LASTEXITCODE
