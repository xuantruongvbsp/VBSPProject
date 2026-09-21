# One-command VSPPRO setup: set the admin password (SHA-256 hash) in config.json.
#
# Auto-detects the config location:
#   - source layout:   public/config.json
#   - portable layout: app/config.json
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File setup.ps1               (interactive)
#   powershell -ExecutionPolicy Bypass -File setup.ps1 -Password 'secret'
#
# After setting the password, run build-portable.bat (source) or Mo VSPPRO.bat (portable).

param(
    [string]$Password
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

# --- Locate config.json -----------------------------------------------------
$candidates = @(
    (Join-Path $root 'public\config.json'),
    (Join-Path $root 'app\config.json'),
    (Join-Path $root 'config.json')
)
$cfgFile = $null
foreach ($c in $candidates) {
    if (Test-Path $c) { $cfgFile = $c; break }
}
if (-not $cfgFile) {
    Write-Host 'ERROR: config.json not found.' -ForegroundColor Red
    Write-Host 'Run this script from the VSPPRO source root or the portable VSPPRO folder.' -ForegroundColor Red
    exit 1
}

# --- Read the password ------------------------------------------------------
function Read-PasswordMasked([string]$Prompt) {
    $secure = Read-Host -Prompt $Prompt -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

$plain = $Password
if (-not $plain) {
    $plain = Read-PasswordMasked 'New admin password'
    if (-not $plain) { Write-Host 'Cancelled (no password entered).' -ForegroundColor Yellow; exit 0 }
    $confirm = Read-PasswordMasked 'Confirm password'
    if ($plain -cne $confirm) { Write-Host 'Passwords do not match.' -ForegroundColor Red; exit 1 }
}

# --- SHA-256 (UTF-8, matches the app) --------------------------------------
function Get-Sha256Hex([string]$text) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hash = $sha.ComputeHash($bytes)
        return -join ($hash | ForEach-Object { $_.ToString('x2') })
    } finally {
        $sha.Dispose()
    }
}
$hex = Get-Sha256Hex $plain

# --- Write config.json (keep other fields, UTF-8 without BOM) ---------------
# Chỉ thay đúng giá trị ownerPasswordSha256, giữ nguyên các trường khác (như
# _comment có tiếng Việt) để tránh lỗi mã hóa do ConvertTo-Json gây ra.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$raw = [System.IO.File]::ReadAllText($cfgFile, $utf8NoBom)
$raw = [regex]::Replace($raw, '("ownerPasswordSha256"\s*:\s*")[0-9a-fA-F]*(")', ('${1}' + $hex + '${2}'))
[System.IO.File]::WriteAllText($cfgFile, $raw, $utf8NoBom)

Write-Host ''
Write-Host 'Admin password set successfully.' -ForegroundColor Green
Write-Host "  Config file: $cfgFile"
Write-Host ''
Write-Host 'Next steps:'
if (Test-Path (Join-Path $root 'build-portable.bat')) {
    Write-Host '  - Run build-portable.bat to package the portable build (if sharing).'
}
Write-Host '  - Run Mo VSPPRO.bat (portable) or npm run dev (source) to open the app.'
