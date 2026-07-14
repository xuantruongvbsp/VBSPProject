# Encrypt the IMS password with DPAPI and store it into config.json (field: passwordEnc).
# Only the current Windows user on this machine can decrypt it.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File set-password.ps1 -Password 'THE_PASSWORD'
# Optional: -Username KIETMT0001  (also updates config.username)

param(
    [Parameter(Mandatory = $true)][string]$Password,
    [string]$Username
)

$ErrorActionPreference = 'Stop'
$here    = Split-Path -Parent $MyInvocation.MyCommand.Path
$cfgFile = Join-Path $here 'config.json'
if (-not (Test-Path $cfgFile)) { throw "Missing config.json: $cfgFile" }

$cfg = Get-Content $cfgFile -Raw | ConvertFrom-Json
$cfg.passwordEnc = (ConvertTo-SecureString $Password -AsPlainText -Force | ConvertFrom-SecureString)
if ($Username) { $cfg.username = $Username }

# Write UTF-8 WITHOUT BOM (Node's JSON.parse rejects a BOM)
$json = $cfg | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($cfgFile, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Encrypted password stored in config.json (passwordEnc). User: $($cfg.username)"
