$ErrorActionPreference = 'Stop'

$apiDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$repoRoot = (Resolve-Path (Join-Path $apiDirectory '..\..')).Path
$envPath = Join-Path $apiDirectory '.env'
$examplePath = Join-Path $apiDirectory '.env.example'

if (-not (Test-Path -LiteralPath $envPath)) {
    Copy-Item -LiteralPath $examplePath -Destination $envPath
}

$relativeEnvPath = 'services/api/.env'
& git -C $repoRoot check-ignore --quiet $relativeEnvPath
if ($LASTEXITCODE -ne 0) {
    throw 'services/api/.env is not ignored by git; refusing to write credentials.'
}

Write-Host 'Use values from Uber Direct Developer > API Keys while Viewing test credentials.'
$customerId = (Read-Host 'Uber test Customer ID').Trim()
$clientId = (Read-Host 'Uber test Client ID').Trim()
$secureClientSecret = Read-Host 'Uber test Client secret' -AsSecureString
$secretPointer = [IntPtr]::Zero

try {
    if ($customerId -notmatch '^[A-Za-z0-9-]+$') {
        throw 'Customer ID format is invalid; no credentials were saved.'
    }
    if ($clientId -notmatch '^[A-Za-z0-9._-]+$') {
        throw 'Client ID format is invalid; no credentials were saved.'
    }

    $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureClientSecret)
    $clientSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
    if ([string]::IsNullOrWhiteSpace($clientSecret) -or $clientSecret -match '[\r\n]') {
        throw 'Client secret is empty or invalid; no credentials were saved.'
    }

    $lines = [System.Collections.Generic.List[string]]::new()
    foreach ($line in [System.IO.File]::ReadAllLines($envPath)) {
        $lines.Add($line)
    }

    $settings = [ordered]@{
        UBER_DIRECT_MODE = 'sandbox'
        UBER_DIRECT_CUSTOMER_ID = $customerId
        UBER_DIRECT_CLIENT_ID = $clientId
        UBER_DIRECT_CLIENT_SECRET = $clientSecret
    }

    foreach ($name in $settings.Keys) {
        $pattern = '^\s*' + [regex]::Escape($name) + '\s*=.*$'
        $matches = @($lines | Where-Object { $_ -match $pattern })
        if ($matches.Count -gt 1) {
            throw "Found duplicate $name entries; no credentials were saved."
        }

        $replacement = "$name=$($settings[$name])"
        if ($matches.Count -eq 1) {
            for ($index = 0; $index -lt $lines.Count; $index++) {
                if ($lines[$index] -match $pattern) {
                    $lines[$index] = $replacement
                    break
                }
            }
        } else {
            $lines.Add($replacement)
        }
    }

    [System.IO.File]::WriteAllLines($envPath, $lines.ToArray(), [System.Text.UTF8Encoding]::new($false))
    Write-Host 'Uber sandbox credentials saved locally. Secret value was not displayed.'
    Write-Host 'Run from the repository root: npm --prefix services/api run uber:sandbox:test'
} finally {
    if ($secretPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
    }
    if ($secureClientSecret) {
        $secureClientSecret.Dispose()
    }
    Remove-Variable clientSecret -ErrorAction SilentlyContinue
}
