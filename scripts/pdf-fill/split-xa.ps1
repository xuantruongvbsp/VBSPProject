param([Parameter(Mandatory=$true)][string]$Path)

$ErrorActionPreference = 'Stop'

# backup
$dir  = Split-Path $Path
$base = [IO.Path]::GetFileNameWithoutExtension($Path)
$backup = Join-Path $dir ($base + '_BACKUP_split.xlsx')
Copy-Item -LiteralPath $Path -Destination $backup -Force
Write-Output "Backup: $backup"

$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
$xl.ScreenUpdating = $false
$miss = [System.Reflection.Missing]::Value

try {
  $wb = $xl.Workbooks.Open($Path)

  # find source sheet (name begins with 02)
  $src = $null
  foreach ($s in $wb.Sheets) { if ($s.Name -like '02*') { $src = $s; break } }
  if ($null -eq $src) { throw 'Source sheet 02* not found' }
  Write-Output ("Source sheet: " + $src.Name)

  # contiguous row range per Xa (col B = 2), data rows 12..107
  $order = New-Object System.Collections.Generic.List[string]
  $minR = @{}; $maxR = @{}; $cnt = @{}
  for ($r = 12; $r -le 107; $r++) {
    $val = $src.Cells.Item($r, 2).Value2
    if ($null -eq $val) { continue }
    $v = ([string]$val).Trim()
    if ($v -eq '') { continue }
    if (-not $minR.ContainsKey($v)) { $order.Add($v); $minR[$v] = $r; $cnt[$v] = 0 }
    $maxR[$v] = $r; $cnt[$v] = $cnt[$v] + 1
  }
  Write-Output ("Xa found: " + $order.Count)

  $invalid = ':','\','/','?','*','[',']'
  $afterSheet = $src
  foreach ($xa in $order) {
    # copy the source sheet; the new copy becomes the ActiveSheet
    $src.Copy($miss, $afterSheet)
    $new = $wb.ActiveSheet
    $afterSheet = $new

    # sheet name (<=31 chars, strip invalid)
    $name = $xa
    foreach ($ch in $invalid) { $name = $name.Replace($ch, ' ') }
    if ($name.Length -gt 31) { $name = $name.Substring(0, 31) }
    $new.Name = $name

    # remove any slicer shapes copied onto this sheet (msoSlicer = 25)
    foreach ($sh in @($new.Shapes)) { try { if ($sh.Type -eq 25) { $sh.Delete() } } catch {} }

    # clear any active filter so no rows are hidden before deleting
    try { if ($new.FilterMode) { $new.ShowAllData() } } catch {}

    $mn = $minR[$xa]; $mx = $maxR[$xa]
    $contig = (($mx - $mn + 1) -eq $cnt[$xa])
    if ($contig) {
      if ($mx -lt 107) { [void]$new.Rows.Item(($mx + 1).ToString() + ':107').Delete() }
      if ($mn -gt 12)  { [void]$new.Rows.Item('12:' + ($mn - 1).ToString()).Delete() }
    } else {
      for ($r = 107; $r -ge 12; $r--) {
        $val = $new.Cells.Item($r, 2).Value2
        $v = if ($null -eq $val) { '' } else { ([string]$val).Trim() }
        if ($v -ne $xa) { [void]$new.Rows.Item($r).Delete() }
      }
    }
    Write-Output ("  -> '" + $name + "'  rows=" + $cnt[$xa] + " contiguous=" + $contig)
  }

  # tidy original
  try { if ($src.FilterMode) { $src.ShowAllData() } } catch {}

  $xl.CalculateFull()
  $wb.Save()
  $wb.Close($true)
  $xl.Quit()
  Write-Output 'DONE'
}
catch {
  Write-Output ('ERROR: ' + $_.Exception.Message)
  try { $wb.Close($false) } catch {}
  try { $xl.Quit() } catch {}
  throw
}
finally {
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl) | Out-Null
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
