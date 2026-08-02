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
    5. install.ps1 param() is the first executable statement (no stray
       lines like "$null = 0" before it — breaks -File parse)
    6. install.ps1 Prisma data dir + db push exit-code check
    7. WinSW xml templates parse + have required tokens/elements

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

# ---- 5. install.ps1 param() placement regression ---------------------------
Write-Host ''
Write-Host '  install.ps1 param() must be first executable statement' -ForegroundColor DarkGray
# PowerShell requires param() before any executable statement. A stray line
# like "$null = 0" before param() turns [CmdletBinding()] param() into an
# invalid expression -> "Unexpected attribute 'CmdletBinding'" parse error,
# even when invoked via -File. Only #Requires, comments, and using may precede.
$lines = Get-Content $installPs1
$badBeforeParam = $false
foreach ($l in $lines) {
    $t = $l.Trim()
    if ($t -eq '') { continue }
    if ($t -match '^#') { continue }            # comment
    if ($t -match '^#Requires') { continue }      # #Requires directive
    if ($t -match '^using ') { continue }        # using statement
    if ($t -match '^param\(' -or $t -match '^\[CmdletBinding') { break }  # reached param block
    # Executable statement before param() — BUG
    $badBeforeParam = $true
    Write-Host "      bad line: $l" -ForegroundColor DarkGray
    break
}
if ($badBeforeParam) {
    Show-Fail "install.ps1 has executable statement before param() (parse breaks -File)"
} else {
    Show-Pass "install.ps1 param() is first executable statement"
}

# ---- 6. install.ps1 Prisma regression --------------------------------------
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

# ---- 7. WinSW xml templates ------------------------------------------------
Write-Host ''
Write-Host '  WinSW xml templates' -ForegroundColor DarkGray
$winswXmls = @(
    @{ file = Join-Path $repo 'griphook-win-service.xml';      java = $true;  node = $false },
    @{ file = Join-Path $repo 'griphook-win-service-ui.xml';   java = $false; node = $true  }
)
foreach ($x in $winswXmls) {
    $f = $x.file
    if (-not (Test-Path $f)) { Show-Fail "missing WinSW xml: $f"; continue }
    try {
        [xml](Get-Content -Raw $f) | Out-Null
        $raw = Get-Content -Raw $f
        $hasId    = $raw -match '<id>(Griphook|GriphookUI)</id>'
        $hasExec  = $raw -match '<executable>'
        $hasLog   = $raw -match 'mode="roll-by-size"'
        $hasDepend = $true
        if ($x.node) { $hasDepend = $raw -match '<depend>Griphook</depend>' }
        if ($x.java) { $hasDepend = $raw -notmatch '<depend>' }  # backend has no dependency
        $tokenOk = $true
        if ($x.java) { $tokenOk = $raw -match '__JAVA_EXE__' -and $raw -match '__ENV_VARS__' }
        if ($x.node) { $tokenOk = $raw -match '__NODE_EXE__' -and $raw -match '__ENV_VARS__' }
        if ($hasId -and $hasExec -and $hasLog -and $hasDepend -and $tokenOk) {
            Show-Pass "WinSW xml valid: $(Split-Path -Leaf $f)"
        } else {
            Show-Fail "WinSW xml invalid/incomplete: $(Split-Path -Leaf $f)"
            if (-not $hasId)     { Write-Host "      missing <id>" -ForegroundColor DarkGray }
            if (-not $hasExec)   { Write-Host "      missing <executable>" -ForegroundColor DarkGray }
            if (-not $hasLog)    { Write-Host "      missing roll-by-size log" -ForegroundColor DarkGray }
            if (-not $hasDepend) { Write-Host "      missing/wrong <depend>" -ForegroundColor DarkGray }
            if (-not $tokenOk)   { Write-Host "      missing __JAVA_EXE__/__NODE_EXE__/__ENV_VARS__ token" -ForegroundColor DarkGray }
        }
    } catch {
        Show-Fail "WinSW xml parse error in $f : $($_.Exception.Message)"
    }
}

# ---- Summary ---------------------------------------------------------------
Write-Host ''
if ($fail -eq 0) {
    Write-Host "  ALL PASS  $pass/7" -ForegroundColor Green
} else {
    Write-Host "  $fail FAILED  $pass/7 passed" -ForegroundColor Red
}
Write-Host ''
exit $fail