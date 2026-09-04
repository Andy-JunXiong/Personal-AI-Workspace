[CmdletBinding()]
param(
  [string]$DatabasePath = (Join-Path $env:LOCALAPPDATA "PersonalAIWorkspace\data\workspace.db"),
  [string]$OutputDirectory = (Join-Path $env:LOCALAPPDATA "PersonalAIWorkspace\migration"),
  [switch]$WorkspaceStopped
)

$ErrorActionPreference = "Stop"

if (-not $WorkspaceStopped) {
  throw "Stop the local Personal AI Workspace process, then rerun with -WorkspaceStopped."
}

$source = Get-Item -LiteralPath $DatabasePath
if ($source.PSIsContainer -or ($source.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
  throw "The source must be a regular, non-link database file."
}

foreach ($sidecarSuffix in @("-wal", "-shm")) {
  $sidecar = "$($source.FullName)$sidecarSuffix"
  if (Test-Path -LiteralPath $sidecar) {
    throw "SQLite sidecar still exists: $sidecar. Confirm the Workspace process stopped cleanly before retrying."
  }
}

# This is a best-effort lock check in addition to the explicit stopped-process
# acknowledgement. It catches another process that currently holds the file.
$handle = [IO.File]::Open(
  $source.FullName,
  [IO.FileMode]::Open,
  [IO.FileAccess]::Read,
  [IO.FileShare]::None
)
$handle.Dispose()

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$verifier = Join-Path $repoRoot "dist\scripts\verify-database.js"
if (-not (Test-Path -LiteralPath $verifier -PathType Leaf)) {
  throw "Missing built database verifier. Run 'npm run build' in $repoRoot, then retry."
}

& node $verifier $source.FullName
if ($LASTEXITCODE -ne 0) {
  throw "Source database verification failed."
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$resolvedOutput = (Resolve-Path $OutputDirectory).Path
$timestamp = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssZ")
$backupName = "paw-c3-source-$timestamp.db"
$backupPath = Join-Path $resolvedOutput $backupName
Copy-Item -LiteralPath $source.FullName -Destination $backupPath

& node $verifier $backupPath
if ($LASTEXITCODE -ne 0) {
  Remove-Item -LiteralPath $backupPath -Force
  throw "Copied database verification failed; the invalid copy was removed."
}

$copied = Get-Item -LiteralPath $backupPath
$sha256 = (Get-FileHash -LiteralPath $backupPath -Algorithm SHA256).Hash.ToLowerInvariant()
$manifest = [ordered]@{
  schema = "paw-c3-source-v1"
  createdAtUtc = [DateTime]::UtcNow.ToString("o")
  database = $copied.Name
  bytes = $copied.Length
  sha256 = $sha256
}
$manifestPath = "$backupPath.json"
$manifest | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding utf8

Write-Output "C3 source prepared without modifying the original database."
Write-Output "Database: $backupPath"
Write-Output "Manifest: $manifestPath"
Write-Output "SHA256: $sha256"
