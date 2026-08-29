param(
  [Parameter(Mandatory = $true)][string]$CandidatePath,
  [Parameter(Mandatory = $true)][string]$OutputPath
)

$ErrorActionPreference = "Stop"
$values = @(Get-Content -LiteralPath $CandidatePath -Raw -Encoding UTF8 | ConvertFrom-Json)

function New-BingTranslationSession {
  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $page = (Invoke-WebRequest -Uri "https://www.bing.com/translator" -WebSession $session -TimeoutSec 30).Content
  $ig = [regex]::Match($page, 'IG:"([A-F0-9]+)"').Groups[1].Value
  $auth = [regex]::Match($page, 'params_AbusePreventionHelper = \[(\d+),"([^"]+)"')
  if (-not $ig -or -not $auth.Success) { throw "Could not read Bing translator session parameters" }
  return [pscustomobject]@{
    Session = $session
    Ig = $ig
    Key = $auth.Groups[1].Value
    Token = $auth.Groups[2].Value
    Iid = 0
  }
}

function Invoke-BingTranslation {
  param(
    [Parameter(Mandatory = $true)]$Session,
    [Parameter(Mandatory = $true)][string]$Text,
    [Parameter(Mandatory = $true)][string]$Target
  )
  $Session.Iid += 1
  $uri = "https://www.bing.com/ttranslatev3?isVertical=1&&IG=$($Session.Ig)&IID=translator.5025.$($Session.Iid)"
  $body = @{
    fromLang = "ja"
    to = $Target
    text = $Text
    token = $Session.Token
    key = $Session.Key
    tryFetchingGenderDebiasedTranslations = "true"
  }
  for ($attempt = 1; $attempt -le 4; $attempt += 1) {
    try {
      $response = Invoke-RestMethod -Method Post -Uri $uri -WebSession $Session.Session -Body $body -TimeoutSec 45
      return [string]$response[0].translations[0].text
    } catch {
      if ($attempt -eq 4) {
        Write-Error "Translation request failed target=$Target length=$($Text.Length) text=$($Text.Substring(0, [Math]::Min(220, $Text.Length)))"
        throw
      }
      Start-Sleep -Seconds ($attempt * 2)
    }
  }
}

function New-TranslationBatches {
  param([object[]]$Items)
  $batches = New-Object System.Collections.Generic.List[object]
  $current = New-Object System.Collections.Generic.List[object]
  $length = 0
  for ($index = 0; $index -lt $Items.Count; $index += 1) {
    $value = [string]$Items[$index]
    $extra = $value.Length + $(if ($current.Count) { 34 } else { 0 })
    if ($current.Count -and ($current.Count -ge 25 -or ($length + $extra) -gt 800)) {
      $batches.Add($current.ToArray())
      $current = New-Object System.Collections.Generic.List[object]
      $length = 0
    }
    $current.Add([pscustomobject]@{ Value = $value; Index = $index })
    $length += $extra
  }
  if ($current.Count) { $batches.Add($current.ToArray()) }
  Write-Output -NoEnumerate $batches.ToArray()
}

function Convert-UiLiterals {
  param(
    [object[]]$Items,
    [string]$Target
  )
  $session = New-BingTranslationSession
  $result = [ordered]@{}
  $batches = New-Object System.Collections.Generic.List[object]
  $current = New-Object System.Collections.Generic.List[object]
  $length = 0
  for ($itemIndex = 0; $itemIndex -lt $Items.Count; $itemIndex += 1) {
    $value = [string]$Items[$itemIndex]
    $extra = $value.Length + $(if ($current.Count) { 34 } else { 0 })
    if ($current.Count -and ($current.Count -ge 25 -or ($length + $extra) -gt 800)) {
      $batches.Add($current.ToArray())
      $current = New-Object System.Collections.Generic.List[object]
      $length = 0
    }
    $current.Add([pscustomobject]@{ Value = $value; Index = $itemIndex })
    $length += $extra
  }
  if ($current.Count) { $batches.Add($current.ToArray()) }
  for ($batchIndex = 0; $batchIndex -lt $batches.Count; $batchIndex += 1) {
    $batch = @($batches[$batchIndex])
    $segments = New-Object System.Collections.Generic.List[string]
    for ($index = 0; $index -lt $batch.Count; $index += 1) {
      if ($index) { $segments.Add("<<<DCATS_SPLIT_$($batch[$index].Index)>>>") }
      $segments.Add([string]$batch[$index].Value)
    }
    $translated = Invoke-BingTranslation -Session $session -Text ($segments -join "`n") -Target $Target
    $parts = @($translated -split '\s*<<<DCATS_SPLIT_\d+>>>\s*')
    if ($parts.Count -ne $batch.Count) {
      foreach ($item in $batch) {
        $result[[string]$item.Value] = (Invoke-BingTranslation -Session $session -Text ([string]$item.Value) -Target $Target).Trim()
      }
    } else {
      for ($index = 0; $index -lt $batch.Count; $index += 1) {
        $result[[string]$batch[$index].Value] = ([string]$parts[$index]).Trim()
      }
    }
    Write-Host "$Target`: $($batchIndex + 1)/$($batches.Count)"
  }
  return $result
}

$payload = [ordered]@{
  en = Convert-UiLiterals -Items $values -Target "en"
  zh = Convert-UiLiterals -Items $values -Target "zh-Hans"
}
$payload | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
