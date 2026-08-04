[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet("finished_product", "box")]
  [string]$LabelTarget = "finished_product",

  [switch]$Watch,

  [ValidateRange(5, 300)]
  [int]$RestartDelaySeconds = 15
)

$ErrorActionPreference = "Stop"

$edgeCandidates = @(
  (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"),
  (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe")
)
$edgePath = $edgeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $edgePath) {
  throw "Microsoft Edge was not found. Install Edge before starting the D-CATS print station."
}

$stationProfile = Join-Path $env:LOCALAPPDATA "D-CATS\TD-4420TN-PrintStation"
New-Item -ItemType Directory -Path $stationProfile -Force | Out-Null
$stationUrl = "https://dcats.daiko-denki.co.jp/?dcats_print_station=td4420tn&label_target=$LabelTarget"

$stationArguments = @(
  "--app=$stationUrl",
  "--kiosk-printing",
  "--no-first-run",
  "--disable-session-crashed-bubble",
  "--user-data-dir=$stationProfile"
)

function Test-DcatsPrintStationRunning {
  try {
    return [bool](Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe'" |
      Where-Object { $_.CommandLine -and $_.CommandLine.Contains("TD-4420TN-PrintStation") } |
      Select-Object -First 1)
  } catch {
    Write-Warning "Could not inspect the Edge process. The print station will be started once. $($_.Exception.Message)"
    return $false
  }
}

function Start-DcatsPrintStation {
  Start-Process -FilePath $edgePath -ArgumentList $stationArguments
}

if (-not $Watch) {
  Start-DcatsPrintStation
  return
}

$watchdogMutex = [System.Threading.Mutex]::new($false, "Local\DcatsTD4420TNPrintStationWatchdog")
$ownsMutex = $false
try {
  $ownsMutex = $watchdogMutex.WaitOne(0, $false)
  if (-not $ownsMutex) {
    return
  }
  while ($true) {
    if (-not (Test-DcatsPrintStationRunning)) {
      Start-DcatsPrintStation
      Start-Sleep -Seconds $RestartDelaySeconds
    }
    Start-Sleep -Seconds $RestartDelaySeconds
  }
} finally {
  if ($ownsMutex) {
    $watchdogMutex.ReleaseMutex()
  }
  $watchdogMutex.Dispose()
}
