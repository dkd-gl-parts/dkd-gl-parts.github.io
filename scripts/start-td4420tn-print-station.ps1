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

$stationArguments = @(
  "--app=https://dcats.daiko-denki.co.jp/",
  "--kiosk-printing",
  "--no-first-run",
  "--user-data-dir=$stationProfile"
)

Start-Process -FilePath $edgePath -ArgumentList $stationArguments
