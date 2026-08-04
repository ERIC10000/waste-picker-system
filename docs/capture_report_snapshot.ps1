param(
  [string]$BaseUrl = 'https://waste-picker-system.vercel.app'
)

$ErrorActionPreference = 'Stop'

$email = $env:WPS_REPORT_EMAIL
$password = $env:WPS_REPORT_PASSWORD
if ([string]::IsNullOrWhiteSpace($email) -or [string]::IsNullOrWhiteSpace($password)) {
  throw 'Set WPS_REPORT_EMAIL and WPS_REPORT_PASSWORD before capturing the report snapshot.'
}

$loginBody = @{ email = $email; password = $password } | ConvertTo-Json
$login = Invoke-RestMethod `
  -Method Post `
  -Uri "$BaseUrl/api/auth/admin/login" `
  -ContentType 'application/json' `
  -Body $loginBody

$headers = @{ Authorization = "Bearer $($login.access_token)" }
$overview = Invoke-RestMethod -Uri "$BaseUrl/api/reports/overview" -Headers $headers
$communication = Invoke-RestMethod -Uri "$BaseUrl/api/reports/communication" -Headers $headers
$activity = Invoke-RestMethod -Uri "$BaseUrl/api/reports/collections" -Headers $headers

$delivered = ($communication.data | Measure-Object -Property recipient_count -Sum).Sum
$read = ($communication.data | Measure-Object -Property read_count -Sum).Sum
$records = ($activity.data | Measure-Object -Property trips -Sum).Sum
$activeCollectors = @($activity.data | Where-Object { [double]$_.total_kg -gt 0 }).Count
$rejected = if ($null -ne $overview.rejected) {
  [int]$overview.rejected
} else {
  [int](($overview.by_region | Measure-Object -Property rejected -Sum).Sum)
}

$snapshot = [ordered]@{
  captured_at = (Get-Date).ToString('o')
  sources = @(
    "$BaseUrl/api/reports/overview"
    "$BaseUrl/api/reports/communication"
    "$BaseUrl/api/reports/collections"
  )
  total_pickers = [int]$overview.total_pickers
  approved = [int]$overview.approved
  pending = [int]$overview.pending
  rejected = $rejected
  suspended = [int]$overview.suspended
  announcements = [int]$overview.announcements
  messages_delivered = [int]$delivered
  messages_read = [int]$read
  collection_records = [int]$records
  active_collectors = [int]$activeCollectors
  total_kg = [double]$overview.total_kg
  by_region = @($overview.by_region | ForEach-Object {
    [ordered]@{
      region = $_.region
      total = [int]$_.total
      approved = [int]$_.approved
      pending = [int]$_.pending
      rejected = [int]$_.rejected
      suspended = [int]$_.suspended
    }
  })
  by_material = @($overview.by_material | ForEach-Object {
    $label = if ($_.material -eq 'e_waste') { 'E-waste' } else {
      (Get-Culture).TextInfo.ToTitleCase([string]$_.material)
    }
    [ordered]@{ material = $label; kg = [double]$_.kg }
  })
  registration_trend = @($overview.trend | ForEach-Object {
    [ordered]@{ month = $_.month; registrations = [int]$_.registrations }
  })
}

$target = Join-Path $PSScriptRoot 'report_data_snapshot.json'
$json = $snapshot | ConvertTo-Json -Depth 10
$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($target, "$json$([Environment]::NewLine)", $utf8WithoutBom)
Write-Output "Updated $target"
