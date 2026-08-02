#Requires -Version 5.1
<#
  test-installer.ps1
  Local validation of the Windows installer chain. No network install.

  Checks:
    1. install.ps1 parses without syntax errors
    2. docs/install.ps1 wrapper parses without syntax errors
    3. install.bat -Help renders the full help screen (no early fall-through)
    4. docs/install.ps1 wrapper downloads + invokes a mock install.ps1
       with forwarded args (regression test for the Invoke-Expression /
       CmdletBinding bug)

  Run from repo root:
    powershell -ExecutionPolicy Bypass -File test\test-installer.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'

$repo = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repo

$pass = 0
$fail = 0

function Show-Pass($msg) { Write-Host "  PASS  $msg" -ForegroundColor Green; $script:pass++ }
function Show-Fail($msg) { Write-Host "  FAIL  $msg" -ForegroundColor Red;   $script:fail++ }

Write-Host ''
Write-Host '  GRIPHOOK installer local test' -ForegroundColor Cyan
Write-Host "  Repo: $repo" -ForegroundColor DarkGray
Write-Host ''

# ---- 1. Parse install.ps1 --------------------------------------------------
$installPs1 = Join-Path $repo 'install.ps1'
if (-not (Test-Path $installPs1)) { Show-Fail "install.ps1 not found at $installPs1"; exit 1 }
try {
    $tokens = $null; $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($installPs1, [ref]$tokens, [ref]$errors) | Out-Null
    if ($errors.Count -gt 0) {
        Show-Fail "install.ps1 parse errors:"
        $errors | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
    } else {
        Show-Pass "install.ps1 parses cleanly"
    }
} catch {
    Show-Fail "install.ps1 parse threw: $($_.Exception.Message)"
}

# ---- 2. Parse docs/install.ps1 ---------------------------------------------
$wrapperPs1 = Join-Path $repo 'docs/install.ps1'
if (-not (Test-Path $wrapperPs1)) { Show-Fail "docs/install.ps1 not found"; exit 1 }
try {
    $tokens = $null; $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($wrapperPs1, [ref]$tokens, [ref]$errors) | Out-Null
    if ($errors.Count -gt 0) {
        Show-Fail "docs/install.ps1 parse errors:"
        $errors | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
    } else {
        Show-Pass "docs/install.ps1 parses cleanly"
    }
} catch {
    Show-Fail "docs/install.ps1 parse threw: $($_.Exception.Message)"
}

# ---- 3. install.bat -Help ---------------------------------------------------
Write-Host ''
Write-Host '  install.bat -Help' -ForegroundColor DarkGray
$helpOut = & cmd.exe /c "$repo\install.bat -Help" 2>&1
$helpText = $helpOut -join "`n"
if ($helpText -match 'GRIPHOOK Windows Installer' -and $helpText -match '-SkipUI') {
    Show-Pass "install.bat -Help renders full help (no early fall-through)"
} else {
    Show-Fail "install.bat -Help did not render help; first 8 lines:"
    $helpOut | Select-Object -First 8 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
}

# ---- 4. Wrapper mock smoke -------------------------------------------------
Write-Host ''
Write-Host '  docs/install.ps1 wrapper (offline mock)' -ForegroundColor DarkGray

# Mock install.ps1 with [CmdletBinding()] param() — this is the shape that broke
# Invoke-Expression. If the wrapper still uses iex, this test FAILS.
$mock = Join-Path $env:TEMP ("griphook-mock-" + [Guid]::NewGuid().ToString('N') + '.ps1')
Set-Content -Path $mock -Encoding ASCII -Value @'
[CmdletBinding()]
param(
    [string]$Msg = 'default'
)
Write-Host "MOCK_INSTALLER_OK msg=$Msg"
exit 0
'@

# Copy wrapper, patch the Invoke-WebRequest line so the "download" becomes a
# local Copy-Item from our mock. (IWR doesn't support file:// in PS 5.1.)
# This exercises the real code path: Unblock-File + powershell -File $tmp @args.
$wrapSrc = Get-Content -Raw $wrapperPs1
$mockEsc = $mock -replace '\\','\\'
$wrapPatched = $wrapSrc -replace 'Invoke-WebRequest -Uri \$src -OutFile \$tmp -UseBasicParsing', "Copy-Item -Path '$mockEsc' -Destination `$tmp"
$wrapTmp = Join-Path $env:TEMP ("griphook-wrap-" + [Guid]::NewGuid().ToString('N') + '.ps1')
Set-Content -Path $wrapTmp -Encoding ASCII -Value $wrapPatched

$wrapOut = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $wrapTmp -Msg 'hello' 2>&1
$wrapText = $wrapOut -join "`n"
if ($wrapText -match 'MOCK_INSTALLER_OK msg=hello') {
    Show-Pass "wrapper ran mock + forwarded -Msg hello (no iex/CmdletBinding error)"
} else {
    Show-Fail "wrapper did not run mock or args not forwarded. Output:"
    $wrapOut | Select-Object -First 10 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
}

Remove-Item -Force -ErrorAction SilentlyContinue $mock, $wrapTmp

# ---- 5. install.ps1 Prisma regression --------------------------------------
Write-Host ''
Write-Host '  install.ps1 Prisma data dir + exit check' -ForegroundColor DarkGray
$ip = Get-Content -Raw $installPs1
$hasDataDir = $ip -match '\$dataDir\s*=\s*Join-Path' -and $ip -match 'New-Item\s+-ItemType\s+Directory'
$hasExitCheck = $ip -match '\$pushExit\s*=\s*\$LASTEXITCODE' -and $ip -match 'prisma db push failed'
if ($hasDataDir -and $hasExitCheck) {
    Show-Pass "install.ps1 creates data/ dir + checks prisma exit code"
} else {
    if (-not $hasDataDir) { Show-Fail "install.ps1 missing data/ dir creation (Prisma silent fail bug)" }
    if (-not $hasExitCheck) { Show-Fail "install.ps1 missing prisma db push exit-code check" }
}

# ---- Summary ---------------------------------------------------------------
Write-Host ''
if ($fail -eq 0) {
    Write-Host "  ALL PASS  $pass/5" -ForegroundColor Green
} else {
    Write-Host "  $fail FAILED  $pass/5 passed" -ForegroundColor Red
}
Write-Host ''
exit $fail