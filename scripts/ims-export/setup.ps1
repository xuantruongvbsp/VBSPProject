# Register the Scheduled Task that runs the export daily (including weekends).
# Reads schedule time + username from config.json.
# Make sure you ran set-password.ps1 first so config.passwordEnc is set.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File setup.ps1
# Optional overrides:
#   -Time 07:45  -TaskName 'IMS_SaoKe_KTKSNB_Daily'

param(
    [string]$Time,
    [string]$TaskName = 'IMS_SaoKe_KTKSNB_Daily'
)

$ErrorActionPreference = 'Stop'
$here    = Split-Path -Parent $MyInvocation.MyCommand.Path
$cfgFile = Join-Path $here 'config.json'
$runner  = Join-Path $here 'run-export.ps1'

$cfg = Get-Content $cfgFile -Raw | ConvertFrom-Json
if (-not $Time) { $Time = if ($cfg.scheduleTime) { $cfg.scheduleTime } else { '07:45' } }
if (-not $cfg.passwordEnc) { Write-Warning "config.passwordEnc is empty - run set-password.ps1 before the task can work." }

$action  = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}"' -f $runner)
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Settings $settings -Principal $principal -Force | Out-Null

Write-Host "Registered scheduled task '$TaskName' - daily at $Time (runs as $env:USERNAME when logged on)."
Write-Host "Test now with:  Start-ScheduledTask -TaskName '$TaskName'"
