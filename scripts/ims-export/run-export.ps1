# Launcher for the IMS_REPORTS daily export.
# Reads config.json, decrypts the DPAPI-protected password, runs the Playwright exporter.
# Registered in Task Scheduler to run daily.

$ErrorActionPreference = 'Stop'
$here    = Split-Path -Parent $MyInvocation.MyCommand.Path
$cfgFile = Join-Path $here 'config.json'
$logDir  = Join-Path $here 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir ("export_{0}.log" -f (Get-Date -Format 'yyyy-MM-dd'))

function Write-Log($msg) { "{0}  {1}" -f (Get-Date -Format 'HH:mm:ss'), $msg | Tee-Object -FilePath $log -Append }

try {
    Write-Log "=== Run start ==="
    if (-not (Test-Path $cfgFile)) { throw "Missing config.json: $cfgFile" }
    $cfg = Get-Content $cfgFile -Raw | ConvertFrom-Json
    if (-not $cfg.passwordEnc) { throw "config.passwordEnc is empty. Set it with set-password.ps1 first." }

    # Decrypt password (DPAPI - only this Windows user on this machine can read it)
    $sec   = $cfg.passwordEnc | ConvertTo-SecureString
    $bstr  = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

    $env:IMS_PASS = $plain
    $node = (Get-Command node).Source
    Write-Log ("Running exporter (user={0}, node={1})..." -f $cfg.username, $node)
    & $node (Join-Path $here 'export-kt740.mjs') 2>&1 | Tee-Object -FilePath $log -Append
    $code = $LASTEXITCODE
    $env:IMS_PASS = $null
    if ($code -ne 0) { throw "Exporter exited with code $code" }
    Write-Log "=== Run OK ==="
}
catch {
    Write-Log ("ERROR: " + $_.Exception.Message)
    exit 1
}
