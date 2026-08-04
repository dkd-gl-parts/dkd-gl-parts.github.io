[CmdletBinding()]
param(
  [ValidateSet("finished_product", "box")]
  [string]$LabelTarget = "finished_product",

  [string]$PrinterName = "",

  [switch]$PreventSleep,

  [switch]$LaunchNow
)

$ErrorActionPreference = "Stop"

$sourceLauncherPath = Join-Path $PSScriptRoot "start-td4420tn-print-station.ps1"
if (-not (Test-Path -LiteralPath $sourceLauncherPath)) {
  throw "The TD-4420TN print-station launcher was not found: $sourceLauncherPath"
}

$powershellPath = Join-Path $PSHOME "powershell.exe"
if (-not (Test-Path -LiteralPath $powershellPath)) {
  $powershellPath = (Get-Command powershell.exe -ErrorAction Stop).Source
}

$windowsPrinterSettings = "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Windows"
Set-ItemProperty -LiteralPath $windowsPrinterSettings -Name "LegacyDefaultPrinterMode" -Type DWord -Value 1
Write-Output "Windows automatic default-printer switching has been disabled for this user."

$allPrinters = @(Get-CimInstance Win32_Printer)
if ($PrinterName) {
  $targetPrinters = @($allPrinters | Where-Object { $_.Name -eq $PrinterName })
} else {
  $targetPrinters = @($allPrinters | Where-Object {
    -not $_.WorkOffline -and "$($_.Name) $($_.DriverName)" -match "TD[- ]?4420TN"
  })
}
if ($targetPrinters.Count -eq 0) {
  throw "An online TD-4420TN was not found. Turn it on, confirm the USB or LAN connection, and run the installer again."
}
if ($targetPrinters.Count -gt 1) {
  $names = ($targetPrinters | ForEach-Object { $_.Name }) -join "', '"
  throw "Multiple TD-4420TN printers were found: '$names'. Run the installer again with -PrinterName and the exact printer name."
}
$targetPrinter = $targetPrinters[0]
if ($targetPrinter.WorkOffline) {
  throw "The selected TD-4420TN '$($targetPrinter.Name)' is offline."
}

$printerNetwork = New-Object -ComObject WScript.Network
$printerNetwork.SetDefaultPrinter($targetPrinter.Name)
Start-Sleep -Milliseconds 300
$defaultPrinter = Get-CimInstance Win32_Printer | Where-Object { $_.Default } | Select-Object -First 1
if (-not $defaultPrinter -or $defaultPrinter.Name -ne $targetPrinter.Name) {
  throw "The TD-4420TN could not be set as the Windows default printer."
}
Write-Output "Default printer configured: $($defaultPrinter.Name)"

if ($PreventSleep) {
  & powercfg.exe /change standby-timeout-ac 0
  if ($LASTEXITCODE -ne 0) {
    throw "Windows sleep prevention could not be configured. Run this installer from an elevated PowerShell window."
  }
  Write-Output "AC-powered sleep has been disabled for reliable print-station operation."
}

$installDirectory = Join-Path $env:LOCALAPPDATA "D-CATS\TD-4420TN-PrintStation"
New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null
$launcherPath = Join-Path $installDirectory "start-td4420tn-print-station.ps1"
Copy-Item -LiteralPath $sourceLauncherPath -Destination $launcherPath -Force

$startupDirectory = [Environment]::GetFolderPath("Startup")
if (-not $startupDirectory) {
  throw "The current user's Windows Startup folder could not be resolved."
}

$shortcutPath = Join-Path $startupDirectory "D-CATS TD-4420TN Print Station.lnk"
$launcherArguments = @(
  "-NoProfile",
  "-ExecutionPolicy Bypass",
  "-WindowStyle Hidden",
  "-File `"$launcherPath`"",
  "-LabelTarget $LabelTarget",
  "-Watch"
) -join " "

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powershellPath
$shortcut.Arguments = $launcherArguments
$shortcut.WorkingDirectory = $installDirectory
$shortcut.Description = "D-CATS TD-4420TN automatic print station"
$shortcut.Save()

Write-Output "Startup shortcut installed: $shortcutPath"
Write-Output "Print-station launcher installed: $launcherPath"
Write-Output "Label target: $LabelTarget"

if ($LaunchNow) {
  Start-Process -FilePath $powershellPath -ArgumentList $launcherArguments -WindowStyle Hidden
  Write-Output "The D-CATS print station was started. Complete the D-CATS login in the Edge window once."
}
