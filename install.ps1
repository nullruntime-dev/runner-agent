#Requires -Version 5.1
<#
.SYNOPSIS
    GRIPHOOK Windows Installer
.DESCRIPTION
    Installs GRIPHOOK (AI-Powered Deployment Agent) on Windows.
    Handles Java 21, Node.js, Git, builds backend + UI, and registers
    Windows services via WinSW.
.PARAMETER Method
    Installation method: source (default, only supported method on Windows).
.PARAMETER InstallDir
    Install location (default: C:\ProgramData\Griphook).
.PARAMETER SkipServices
    Skip Windows service creation (run manually instead).
.PARAMETER SkipUI
    Install only the backend agent (no frontend UI). Use this when you
    already have a UI instance elsewhere and just want to add another
    agent to it. One UI can manage multiple agents via the Add Agent
    page in the dashboard.
.PARAMETER NoPause
    Don't pause for a keypress at the end of the script. By default the
    installer waits so you can read/copy the agent token printed by
    Write-NextSteps before the window closes. Pass this for CI / automation.
.PARAMETER CliExecutor
    Install the CLI Executor (remote command runner) instead of the full
    GRIPHOOK agent + UI. Skips the interactive product prompt. The executor
    builds from source + registers as the GriphookCliExecutor Windows service.
.PARAMETER CliExecutorDir
    Install directory for the CLI Executor (default:
    ${env:ProgramData}\GriphookCliExecutor). Only used with -CliExecutor.
.EXAMPLE
    irm https://griphook.dev/install.ps1 | iex
#>

[CmdletBinding()]
param(
    [ValidateSet('source')]
    [string]$Method = 'source',
    [string]$InstallDir = "${env:ProgramData}\Griphook",
    [switch]$SkipServices,
    [switch]$SkipUI,
    [switch]$NoPause,
    [switch]$CliExecutor,
    [string]$CliExecutorDir = "${env:ProgramData}\GriphookCliExecutor"
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# -- Configuration ----------------------------------------------------------
$GithubRepo        = 'nullruntime-dev/runner-agent'
$RequiredJavaVer   = 21
$RequiredNodeVer   = 22
$BackendServiceName = 'Griphook'
$FrontendServiceName = 'GriphookUI'

# -- Output helpers ---------------------------------------------------------
function Write-Banner {
    Write-Host ''
    Write-Host '  +-------------------------------------------+' -ForegroundColor Cyan
    Write-Host '  |           GRIPHOOK INSTALLER              |' -ForegroundColor Cyan
    Write-Host '  |       AI-Powered Deployment Agent         |' -ForegroundColor Cyan
    Write-Host '  |              [Windows]                    |' -ForegroundColor Cyan
    Write-Host '  +-------------------------------------------+' -ForegroundColor Cyan
    Write-Host ''
}

function Write-Info    ([string]$m) { Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Success ([string]$m) { Write-Host "[ OK ] $m" -ForegroundColor Green }
function Write-Warn    ([string]$m) { Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-Err     ([string]$m) { Write-Host "[FAIL] $m" -ForegroundColor Red }

# -- Pre-flight checks ------------------------------------------------------
function Test-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($id)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Assert-Admin {
    if (-not (Test-Admin)) {
        Write-Err 'This installer must be run as Administrator.'
        Write-Host ''
        Write-Host '  Right-click PowerShell and choose "Run as Administrator", then re-run:' -ForegroundColor Yellow
        Write-Host '    irm https://griphook.dev/install.ps1 | iex' -ForegroundColor Yellow
        Write-Host ''
        exit 1
    }
    Write-Success 'Running as Administrator'
}

function Assert-Winget {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Write-Err 'winget is required but not installed.'
        Write-Host ''
        Write-Host '  Install App Installer from the Microsoft Store:' -ForegroundColor Yellow
        Write-Host '    https://apps.microsoft.com/detail/9nblggh4nns1' -ForegroundColor Yellow
        Write-Host ''
        exit 1
    }
    Write-Success 'winget is available'
}

# -- PATH refresh (after package installs) ----------------------------------
function Update-SessionPath {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user    = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = @($machine, $user) -join ';'
}

# -- Dependency installers --------------------------------------------------
# Resolve an executable via where.exe (bypasses PowerShell's Get-Command cache,
# which is stale after winget updates PATH mid-session).
# where.exe prints "INFO: Could not find files for the given pattern(s)." to
# stderr on no-match, and with $ErrorActionPreference='Stop' that stderr line
# triggers a NativeCommandError throw (2>$null does not reliably suppress it).
# So we: drop EAP to Continue for the call, merge stderr into stdout, skip
# INFO: banner lines, check $LASTEXITCODE, and Test-Path the candidate.
function Resolve-OnPath {
    param([string]$Name)
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & where.exe $Name 2>&1
    } catch {
        return $null
    } finally {
        $ErrorActionPreference = $prevEap
    }
    if ($LASTEXITCODE -ne 0) { return $null }
    foreach ($line in @($output)) {
        $s = "$line".Trim()
        if ($s -eq '' -or $s -match '^INFO:') { continue }
        if (Test-Path $s) { return $s }
    }
    return $null
}

function Get-JavaMajorVersion {
    $java = Resolve-OnPath 'java'
    if (-not $java) { return 0 }
    try {
        # Java 9+: --version writes to stdout. Fall back to -version (stderr) for older installs.
        $out = & $java --version 2>&1 | Select-Object -First 1
        if (-not $out) {
            $out = & $java -version 2>&1 | Select-Object -First 1
        }
        if ($out -match '(\d+)') { return [int]$matches[1] }
    } catch { }
    return 0
}

function Install-Java {
    $current = Get-JavaMajorVersion
    if ($current -ge $RequiredJavaVer) {
        Write-Success "Java $current found (required: $RequiredJavaVer+)"
        return
    }

    Write-Info "Installing Microsoft OpenJDK $RequiredJavaVer via winget..."
    winget install --id Microsoft.OpenJDK.21 `
        --silent --accept-package-agreements --accept-source-agreements `
        --scope machine | Out-Null

    Update-SessionPath

    $current = Get-JavaMajorVersion
    if ($current -lt $RequiredJavaVer) {
        throw "Java install appeared to succeed but 'java --version' still reports ${current}. Open a new terminal and re-run."
    }
    Write-Success "Java $current installed"
}

function Get-NodeMajorVersion {
    $node = Resolve-OnPath 'node'
    if (-not $node) { return 0 }
    try {
        $v = (& $node -v) -replace '^v', ''
        return [int]($v -split '\.')[0]
    } catch { }
    return 0
}

function Install-Node {
    $current = Get-NodeMajorVersion
    if ($current -ge $RequiredNodeVer) {
        Write-Success "Node.js $current found (required: $RequiredNodeVer+)"
        return
    }

    Write-Info 'Installing Node.js LTS via winget...'
    winget install --id OpenJS.NodeJS.LTS `
        --silent --accept-package-agreements --accept-source-agreements `
        --scope machine | Out-Null

    Update-SessionPath

    $current = Get-NodeMajorVersion
    if ($current -lt $RequiredNodeVer) {
        throw "Node.js install appeared to succeed but 'node -v' still reports ${current}. Open a new terminal and re-run."
    }
    Write-Success "Node.js $current installed"
}

function Install-Git {
    if (Resolve-OnPath 'git') {
        Write-Success 'Git is available'
        return
    }
    Write-Info 'Installing Git via winget...'
    winget install --id Git.Git `
        --silent --accept-package-agreements --accept-source-agreements `
        --scope machine | Out-Null

    Update-SessionPath

    if (-not (Resolve-OnPath 'git')) {
        throw "Git install appeared to succeed but 'git' is still not on PATH. Open a new terminal and re-run."
    }
    Write-Success 'Git installed'
}

# If the backend launcher (griphook-start.bat) already exists from a previous
# install, read its -D lines into the script-scope vars so re-runs default
# to whatever the user already chose. No .env file is used - all config is
# baked directly into the launcher .bat as -D JVM system properties.
function Import-CredsFromLauncher {
    param([string]$LauncherPath)
    if (-not (Test-Path $LauncherPath)) { return }
    foreach ($l in Get-Content $LauncherPath) {
        if ($l -match '^\s*-DAGENT_TOKEN=(.*)$') {
            $script:ExistingToken = $matches[1].TrimEnd(' ').TrimEnd('^').TrimEnd(' ').Trim('"')
        }
        elseif ($l -match '^\s*-DGOOGLE_AI_API_KEY=(.*)$') {
            $script:ExistingApiKey = $matches[1].TrimEnd(' ').TrimEnd('^').TrimEnd(' ').Trim('"')
        }
        elseif ($l -match '^\s*-DSERVER_PORT=(.*)$') {
            $script:ExistingPort = $matches[1].TrimEnd(' ').TrimEnd('^').TrimEnd(' ').Trim('"')
        }
    }
}

# -- Clone + build ----------------------------------------------------------
function Get-Sources {
    param([string]$Destination)

    if (Test-Path $Destination) {
        Write-Info "Cleaning previous source checkout at $Destination"
        Remove-Item -Recurse -Force $Destination
    }
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null

    Write-Info "Cloning $GithubRepo..."
    $repoUrl = "https://github.com/" + $GithubRepo + ".git"
    # Save + restore EAP so git's stderr progress output doesn't become a terminating error.
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & git clone --quiet --depth 1 $repoUrl $Destination *>$null
        $cloneExit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prevEap
    }
    if ($cloneExit -ne 0) { throw "git clone failed (exit $cloneExit)" }
    if (-not (Test-Path (Join-Path $Destination '.git'))) {
        throw "git clone reported success but $Destination\.git does not exist"
    }
    Write-Success 'Source checkout complete'
}

function Build-Backend {
    param([string]$SrcDir, [string]$InstallDir)

    Write-Info 'Building backend with Gradle (this takes a few minutes)...'
    Push-Location $SrcDir
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & cmd.exe /c 'gradlew.bat bootJar --no-daemon 2>&1' | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
        $gradleExit = $LASTEXITCODE
        if ($gradleExit -ne 0) { throw "Gradle build failed (exit $gradleExit)" }
    } finally {
        $ErrorActionPreference = $prevEap
        Pop-Location
    }

    $jar = Get-ChildItem -Path (Join-Path $SrcDir 'build\libs') -Filter '*.jar' |
           Where-Object { $_.Name -notmatch 'plain' } |
           Select-Object -First 1
    if (-not $jar) { throw 'Backend JAR not found after build' }

    $destJar = Join-Path $InstallDir 'griphook-agent.jar'
    Copy-Item -Force $jar.FullName $destJar
    Write-Success "Backend JAR installed: $destJar"
}

function Build-Frontend {
    param([string]$SrcDir, [string]$InstallDir)

    $uiSrc = Join-Path $SrcDir 'ui'
    $uiDest = Join-Path $InstallDir 'ui'

    if (Test-Path $uiDest) {
        Remove-Item -Recurse -Force $uiDest
    }
    Write-Info 'Copying UI sources...'
    Copy-Item -Recurse -Force $uiSrc $uiDest

    Push-Location $uiDest
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        Write-Info 'Installing npm dependencies...'
        & cmd.exe /c 'npm install --loglevel=error 2>&1' | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
        $npmExit = $LASTEXITCODE
        if ($npmExit -ne 0) { throw "npm install failed (exit $npmExit)" }

        # Write UI env before build. (Prisma 7 reads prisma.config.ts for the
        # datasource URL - file:<cwd>/data/runner.db - so .env.local is only
        # for any code that reads process.env.DATABASE_URL directly.)
        Set-Content -Path (Join-Path $uiDest '.env.local') -Value 'DATABASE_URL="file:./data/runner.db"' -Encoding ASCII

        # SQLite won't create the parent dir; prisma.config.ts points at
        # ./data/runner.db relative to CWD, so create data/ before db push.
        $dataDir = Join-Path $uiDest 'data'
        New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

        Write-Info 'Generating Prisma client...'
        & cmd.exe /c 'npx --yes prisma generate 2>&1' | Out-Null
        $genExit = $LASTEXITCODE
        if ($genExit -ne 0) { throw "prisma generate failed (exit $genExit)" }

        Write-Info 'Applying Prisma schema (db push)...'
        & cmd.exe /c 'npx --yes prisma db push --accept-data-loss 2>&1' | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
        $pushExit = $LASTEXITCODE
        if ($pushExit -ne 0) { throw "prisma db push failed (exit $pushExit) - database not initialized" }

        Write-Info 'Building Next.js production bundle...'
        & cmd.exe /c 'npm run build 2>&1' | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
        $buildExit = $LASTEXITCODE
        if ($buildExit -ne 0) { throw "Next.js build failed (exit $buildExit)" }
    } finally {
        $ErrorActionPreference = $prevEap
        Pop-Location
    }

    Write-Success 'Frontend built'
}

# -- Configuration ----------------------------------------------------------
function Test-PortInUse {
    param([int]$Port)
    $tcpConnections = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
    return ($null -ne $tcpConnections) -and (@($tcpConnections).Count -gt 0)
}

function Find-FreePort {
    param([int]$StartPort = 8090)
    $port   = $StartPort
    $cap    = 65535
    $tried  = @()
    while ($port -le $cap) {
        if (-not (Test-PortInUse -Port $port)) {
            return $port
        }
        $tried += $port
        $port += 100
    }
    Write-Warn "Could not find a free port (tried: $($tried -join ', ')). Using $StartPort."
    return $StartPort
}

function New-AgentToken {
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [BitConverter]::ToString($bytes).Replace('-', '').ToLower()
}

# Prompt for all config (token, apiKey, port, PG creds) into script-scope
# vars. On re-runs, defaults come from the existing launcher .bat (imported
# by Import-CredsFromLauncher). On first install, defaults are hardcoded.
function Prompt-Config {
    param([string]$InstallDir)

    $launcher = Join-Path $InstallDir 'griphook-start.bat'
    $existing = Test-Path $launcher

    Write-Host ''
    Write-Host '============================================' -ForegroundColor Cyan
    Write-Host '         Quick Configuration                ' -ForegroundColor Cyan
    Write-Host '============================================' -ForegroundColor Cyan
    if ($existing) {
        Write-Host '   (Re-run: defaults = current values in griphook-start.bat)' -ForegroundColor DarkGray
    }
    Write-Host ''

    Write-Host '1. Google AI API Key ' -NoNewline
    Write-Host '(required for AI chat)' -ForegroundColor Red
    Write-Host '   Get your free key at: https://aistudio.google.com/apikey' -ForegroundColor DarkGray
    $apiKeyDefault = if ($ExistingApiKey) { $ExistingApiKey } else { '' }
    $apiKey = Read-Host "   Enter your Google AI API Key [${apiKeyDefault}]"
    if ([string]::IsNullOrWhiteSpace($apiKey)) { $apiKey = $apiKeyDefault }

    Write-Host ''
    Write-Host '2. Agent Token (API authentication)'
    Write-Host '   Press Enter to auto-generate a secure token.' -ForegroundColor DarkGray
    $tokenDefault = if ($ExistingToken) { $ExistingToken } else { '' }
    if ($tokenDefault) {
        $token = Read-Host "   Enter Agent Token [${tokenDefault}]"
        if ([string]::IsNullOrWhiteSpace($token)) { $token = $tokenDefault }
    } else {
        $token = Read-Host '   Enter Agent Token'
        if ([string]::IsNullOrWhiteSpace($token)) {
            $token = New-AgentToken
            Write-Host "   Generated: $($token.Substring(0,16))..." -ForegroundColor Green
        }
    }

    Write-Host ''
    Write-Host '3. Server Port (Default: 8090)'
    Write-Host '   If the default is in use, we will auto-bump by +100 until a free port is found.' -ForegroundColor DarkGray
    $portDefault = if ($ExistingPort) { $ExistingPort } else { '8090' }
    $port = Read-Host "   Enter Server Port [${portDefault}]"
    if ([string]::IsNullOrWhiteSpace($port)) { $port = $portDefault }
    $portInt = [int]$port
    $suggestedPort = Find-FreePort -StartPort $portInt
    if ($suggestedPort -ne $portInt) {
        Write-Warn "Port $portInt is in use. Using $suggestedPort instead."
        $portInt = $suggestedPort
    }
    $script:ServerPort = "$portInt"

    # Stash for the launcher writer.
    $script:CfgApiKey = $apiKey
    $script:CfgToken  = $token
}

# -- Service wrappers (WinSW) ------------------------------------------------
# A single WinSW binary (griphook-win-service.exe) is committed at the repo
# root + copied into the install dir under two names - one per service - so
# WinSW's exe+xml-same-basename convention is satisfied for both the backend
# and the UI without shipping the 18 MB binary twice.
#
# Env-var handling: NO .env file is used. All backend config (token, api
# key, db creds, etc.) is baked directly into griphook-start.bat as
# `set "X=Y"` lines by Write-BackendLauncher. To change config, edit the
# .bat + Restart-Service Griphook. The UI launcher sets NODE_ENV/PORT
# + runs `next start` (Next.js auto-loads ui/.env.local for its own
# DATABASE_URL).
function Install-WinSw {
    param([string]$SrcDir, [string]$InstallDir)

    $logDir = Join-Path $InstallDir 'logs'
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null

    $srcExe = Join-Path $SrcDir 'griphook-win-service.exe'
    if (-not (Test-Path $srcExe)) {
        throw "WinSW exe not found in cloned repo at $srcExe"
    }

    foreach ($base in @('griphook-win-service', 'griphook-win-service-ui')) {
        $exeDst = Join-Path $InstallDir "$base.exe"
        $xmlSrc = Join-Path $SrcDir "$base.xml"
        $xmlDst = Join-Path $InstallDir "$base.xml"
        if (-not (Test-Path $xmlSrc)) { throw "WinSW xml not found in cloned repo at $xmlSrc" }
        # Copy the single source binary to both service names.
        Copy-Item -Force $srcExe $exeDst
        Copy-Item -Force $xmlSrc $xmlDst
    }
    Write-Success "WinSW binaries installed: $InstallDir"
}

# Generate the backend launcher batch script. All config is passed as -D
# JVM system properties on the java command line - no .env file, no `set`
# lines. Spring's relaxed binding resolves -DAGENT_TOKEN / -DSPRING_DATASOURCE_*
# to the ${VAR:default} placeholders in application.yml. To change config,
# edit this .bat + Restart-Service Griphook. The java.exe path is baked in
# at install time (resolved from PATH).
function Write-BackendLauncher {
    param([string]$InstallDir, [string]$JavaExe)

    $tempDir = $env:TEMP
    # Embedded SQLite: no DB server, no credentials. The DB file lives
    # under the install dir so it survives service restarts + is easy to
    # back up. WAL + busy_timeout match application.yml defaults.
    $dataDir = Join-Path $InstallDir 'data'
    New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
    $dsUrl   = "jdbc:sqlite:$dataDir\runner.db?journal_mode=WAL&busy_timeout=5000"
    $bat = @(
        '@echo off',
        'rem GRIPHOOK backend launcher (generated by install.ps1).',
        'rem All config passed as -D JVM system properties. Edit this file',
        'rem + Restart-Service Griphook to change config. NO .env file.',
        'rem Values containing spaces/special chars must be double-quoted.',
        "`"$JavaExe`" -Xmx512m ^",
        "  -DAGENT_TOKEN=`"$CfgToken`" ^",
        "  -DGOOGLE_AI_API_KEY=`"$CfgApiKey`" ^",
        "  -DSERVER_PORT=`"$ServerPort`" ^",
        "  -DAGENT_WORKING_DIR=`"$tempDir`" ^",
        '  -DAGENT_DEFAULT_SHELL="cmd.exe" ^',
        '  -DAGENT_MAX_CONCURRENT="5" ^',
        '  -DAGENT_ADK_MODEL="gemini-2.0-flash" ^',
        '  -DAGENT_ADK_ENABLED="true" ^',
        "  -DSPRING_DATASOURCE_URL=`"$dsUrl`" ^",
        '  -jar "%~dp0griphook-agent.jar"'
    )
    $path = Join-Path $InstallDir 'griphook-start.bat'
    Set-Content -Path $path -Value $bat -Encoding ASCII
    Write-Success "Backend launcher written: $path"
}

# Generate the UI launcher batch script. Next.js auto-loads ui/.env.local
# from its working dir, so the launcher just sets NODE_ENV + PORT + runs
# `next start`. The node.exe path is baked in at install time.
function Write-FrontendLauncher {
    param([string]$InstallDir, [string]$NodeExe)

    $bat = @(
        '@echo off',
        'rem GRIPHOOK UI launcher (generated by install.ps1).',
        'rem Next.js auto-loads ui/.env.local from its working dir.',
        'setlocal',
        'set "NODE_ENV=production"',
        'set "PORT=3000"',
        'cd /d "%~dp0ui"',
        "`"$NodeExe`" `"node_modules\next\dist\bin\next`" start -p 3000",
        'endlocal'
    )
    $path = Join-Path $InstallDir 'griphook-start-ui.bat'
    Set-Content -Path $path -Value $bat -Encoding ASCII
    Write-Success "Frontend launcher written: $path"
}

function Remove-ExistingService {
    param([string]$WinSwExe, [string]$Name)

    $svc = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if ($null -ne $svc) {
        Write-Info "Removing existing service: $Name"
        & $WinSwExe stop 2>&1 | Out-Null
        & $WinSwExe uninstall 2>&1 | Out-Null
        Start-Sleep -Seconds 1
    }
}

# Stop + delete any existing Griphook services WITHOUT needing the WinSW exe.
# Called before Install-WinSw so a running service from a previous install
# can't hold a lock on the exe (which would make Copy-Item fail with
# "The process cannot access the file ... because it is being used by
# another process"). Uses Stop-Service + sc.exe delete - both builtin.
function Stop-ExistingServicesForReinstall {
    foreach ($name in @($BackendServiceName, $FrontendServiceName)) {
        $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
        if ($null -eq $svc) { continue }
        Write-Info "Stopping existing service: $name"
        try {
            Stop-Service -Name $name -Force -ErrorAction Stop
        } catch {
            # Service may already be stopped; ignore.
        }
        # Wait for the process to release the lock on the WinSW exe.
        $deadline = (Get-Date).AddSeconds(15)
        while ((Get-Date) -lt $deadline) {
            $s = Get-Service -Name $name -ErrorAction SilentlyContinue
            if ($null -eq $s) { break }
            if ($s.Status -eq 'Stopped') { break }
            Start-Sleep -Milliseconds 500
        }
        Write-Info "Deleting existing service: $name"
        & sc.exe delete $name 2>&1 | Out-Null
        Start-Sleep -Seconds 1
    }
}

function New-BackendService {
    param([string]$InstallDir)

    $javaExe = Resolve-OnPath 'java'
    if (-not $javaExe) { throw "java not found on PATH when creating backend service" }
    if (-not (Test-Path (Join-Path $InstallDir 'griphook-agent.jar'))) {
        throw "griphook-agent.jar not found in $InstallDir - did Build-Backend succeed?"
    }

    Write-BackendLauncher -InstallDir $InstallDir -JavaExe $javaExe

    $winswExe = Join-Path $InstallDir 'griphook-win-service.exe'
    Remove-ExistingService -WinSwExe $winswExe -Name $BackendServiceName

    Write-Info "Creating service: $BackendServiceName"
    & $winswExe install 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
    if ($LASTEXITCODE -ne 0) { throw "WinSW install failed for $BackendServiceName (exit $LASTEXITCODE)" }
    Write-Success "Backend service '$BackendServiceName' created"
}

function New-FrontendService {
    param([string]$InstallDir)

    $uiDir   = Join-Path $InstallDir 'ui'
    $nodeExe = Resolve-OnPath 'node'
    if (-not $nodeExe) { throw "node not found on PATH when creating frontend service" }
    $nextBin = Join-Path $uiDir 'node_modules\next\dist\bin\next'
    if (-not (Test-Path $nextBin)) {
        throw "Next.js binary not found at $nextBin - did 'npm install' succeed?"
    }

    Write-FrontendLauncher -InstallDir $InstallDir -NodeExe $nodeExe

    $winswExe = Join-Path $InstallDir 'griphook-win-service-ui.exe'
    Remove-ExistingService -WinSwExe $winswExe -Name $FrontendServiceName

    Write-Info "Creating service: $FrontendServiceName"
    & $winswExe install 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
    if ($LASTEXITCODE -ne 0) { throw "WinSW install failed for $FrontendServiceName (exit $LASTEXITCODE)" }
    Write-Success "Frontend service '$FrontendServiceName' created"
}

function Start-Services {
    Write-Info "Starting $BackendServiceName..."
    Start-Service -Name $BackendServiceName
    if (-not $SkipUI) {
        Write-Info "Starting $FrontendServiceName..."
        Start-Service -Name $FrontendServiceName
    }
    Write-Success 'Services started'
}

# -- Summary ----------------------------------------------------------------
function Write-NextSteps {
    param(
        [string]$InstallDir,
        [switch]$AgentOnly
    )

    Write-Host ''
    Write-Host '============================================' -ForegroundColor Green
    Write-Host '         Installation Complete!             ' -ForegroundColor Green
    Write-Host '============================================' -ForegroundColor Green
    Write-Host ''
    if ($AgentOnly) {
        Write-Host '  Mode: ' -NoNewline -ForegroundColor Cyan
        Write-Host 'Agent only (no UI on this host)' -ForegroundColor Yellow
        Write-Host ''
        Write-Host "  API:      " -NoNewline -ForegroundColor Cyan
        Write-Host '  http://localhost:8090'
        Write-Host "  Health:   " -NoNewline -ForegroundColor Cyan
        Write-Host '  http://localhost:8090/health'
        Write-Host ''
        Write-Host '  To manage this agent, add it to an existing GRIPHOOK UI:' -ForegroundColor Cyan
        Write-Host '    1. Open your UI dashboard (e.g. http://<ui-host>:3000)'
        Write-Host '    2. Go to Agents -> Add Agent'
        Write-Host '    3. Enter this host URL: http://<this-host>:8090'
        Write-Host '    4. Paste the AGENT_TOKEN shown below'
        Write-Host ''
    } else {
        Write-Host '  Dashboard:' -NoNewline -ForegroundColor Cyan
        Write-Host '  http://localhost:3000'
        Write-Host '  API:      ' -NoNewline -ForegroundColor Cyan
        Write-Host '  http://localhost:8090'
        Write-Host '  Health:   ' -NoNewline -ForegroundColor Cyan
        Write-Host '  http://localhost:8090/health'
        Write-Host ''
    }
    Write-Host '  Install dir: ' -NoNewline -ForegroundColor Cyan
    Write-Host $InstallDir
    Write-Host '  Config file: ' -NoNewline -ForegroundColor Cyan
    Write-Host (Join-Path $InstallDir 'griphook-start.bat')
    Write-Host '  Logs:        ' -NoNewline -ForegroundColor Cyan
    Write-Host (Join-Path $InstallDir 'logs')
    Write-Host ''
    Write-Host '  Database (SQLite, embedded):' -ForegroundColor Cyan
    Write-Host "    $(Join-Path $InstallDir 'data\runner.db')"
    Write-Host ''
    Write-Host '  Service management:' -ForegroundColor Cyan
    Write-Host "    Start-Service $BackendServiceName"
    if (-not $AgentOnly) {
        Write-Host "    Start-Service $FrontendServiceName"
    }
    Write-Host "    Stop-Service  $BackendServiceName"
    if (-not $AgentOnly) {
        Write-Host "    Stop-Service  $FrontendServiceName"
    }
    Write-Host "    Get-Service   $BackendServiceName"
    if (-not $AgentOnly) {
        Write-Host "    Get-Service   $FrontendServiceName"
    }
    Write-Host ''
    Write-Host '  To edit configuration:' -ForegroundColor Cyan
    Write-Host "    notepad $(Join-Path $InstallDir 'griphook-start.bat')"
    Write-Host "    Restart-Service $BackendServiceName"
    Write-Host ''
    Write-Host "  Documentation: https://github.com/$GithubRepo" -ForegroundColor DarkGray
    Write-Host ''

    # Show the agent token so the user can copy it (read back from the
    # launcher .bat where it was baked in).
    $launcher = Join-Path $InstallDir 'griphook-start.bat'
    if (Test-Path $launcher) {
        $savedToken = $null
        $savedPort  = $null
        Get-Content $launcher | ForEach-Object {
            if ($_ -match '^\s*-DAGENT_TOKEN=(.*)$') { $savedToken = $matches[1].TrimEnd(' ').TrimEnd('^').TrimEnd(' ').Trim('"') }
            if ($_ -match '^\s*-DSERVER_PORT=(.*)$') { $savedPort  = $matches[1].TrimEnd(' ').TrimEnd('^').TrimEnd(' ').Trim('"') }
        }
        if ($savedToken) {
            Write-Host '  ============================================' -ForegroundColor Green
            Write-Host '             Your Agent Token                ' -ForegroundColor Green
            Write-Host '  ============================================' -ForegroundColor Green
            Write-Host ''
            Write-Host "  AGENT_TOKEN: " -NoNewline -ForegroundColor Cyan
            Write-Host $savedToken -ForegroundColor Yellow
            Write-Host ''
            Write-Host '  Save this token. You will need it to authenticate' -ForegroundColor DarkGray
            Write-Host '  API requests and to connect the CLI/UI to the agent.' -ForegroundColor DarkGray
            Write-Host ''
            $portForExample = if ($savedPort) { $savedPort } else { '8090' }
            Write-Host '  Example:' -ForegroundColor DarkGray
            Write-Host "    curl http://localhost:${portForExample}/health \" -ForegroundColor Yellow
            Write-Host "      -H `"Authorization: Bearer $savedToken`"" -ForegroundColor Yellow
            Write-Host ''
        }
    }
}

# -- CLI Executor (remote command runner) -----------------------------------
# Separate install path: builds only the cli-executor jar from the same repo,
# registers it as the GriphookCliExecutor Windows service (WinSW), and
# configures either daemon mode (calls runner-agent outbound — works behind
# NAT/firewall) or inbound mode (agent calls this host via POST /executor/run).
# Mirrors install.sh's cli-executor path.

# Build the cli-executor jar (separate gradle project in cli-executor/).
function Build-CliExecutor {
    param([string]$SrcDir, [string]$InstallDir)

    $ceSrc = Join-Path $SrcDir 'cli-executor'
    if (-not (Test-Path $ceSrc)) { throw "cli-executor source not found at $ceSrc" }

    Write-Info 'Building cli-executor with Gradle...'
    Push-Location $ceSrc
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & cmd.exe /c 'gradlew.bat bootJar --no-daemon 2>&1' | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
        $gradleExit = $LASTEXITCODE
        if ($gradleExit -ne 0) { throw "cli-executor Gradle build failed (exit $gradleExit)" }
    } finally {
        $ErrorActionPreference = $prevEap
        Pop-Location
    }

    $jar = Get-ChildItem -Path (Join-Path $ceSrc 'build\libs') -Filter '*.jar' |
           Where-Object { $_.Name -notmatch 'plain' } |
           Select-Object -First 1
    if (-not $jar) { throw 'cli-executor JAR not found after build' }

    $destJar = Join-Path $InstallDir 'cli-executor.jar'
    Copy-Item -Force $jar.FullName $destJar
    Write-Success "cli-executor JAR installed: $destJar"
}

function New-CliExecutorToken {
    $bytes = New-Object byte[] 24
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [BitConverter]::ToString($bytes).Replace('-', '').ToLower()
}

# Read an existing .env so re-runs default to the user's current values.
function Import-CliExecutorConfig {
    param([string]$EnvPath)
    if (-not (Test-Path $EnvPath)) { return }
    foreach ($l in Get-Content $EnvPath) {
        if ($l -match '^\s*SERVER_PORT=(.*)$') { $script:CePort = $matches[1].Trim() }
        elseif ($l -match '^\s*SPRING_APPLICATION_TOKEN=(.*)$') { $script:CeToken = $matches[1].Trim() }
        elseif ($l -match '^\s*RUNNER_URL=(.*)$') { $script:CeRunnerUrl = $matches[1].Trim() }
        elseif ($l -match '^\s*EXECUTOR_ID=(.*)$') { $script:CeExecutorId = $matches[1].Trim() }
        elseif ($l -match '^\s*EXECUTOR_TOKEN=(.*)$) { $script:CeExecutorToken = $matches[1].Trim() }
    }
}

function Prompt-CliExecutorConfig {
    param([string]$InstallDir)

    Write-Host ''
    Write-Host '============================================' -ForegroundColor Cyan
    Write-Host '      CLI Executor Configuration          ' -ForegroundColor Cyan
    Write-Host '============================================' -ForegroundColor Cyan
    Write-Host ''

    # Daemon mode is the primary use case for a remote executor: it calls
    # the runner-agent outbound (register + long-poll /work + post /results),
    # so it works behind NAT/firewall. Ask for the three env vars explicitly.
    Write-Host '  Daemon mode — connect to a GRIPHOOK agent over HTTP' -ForegroundColor Cyan
    Write-Host '  The executor calls the agent outbound, so it works behind NAT/firewall.' -ForegroundColor DarkGray
    Write-Host '  Get these three values from the agent UI:' -ForegroundColor DarkGray
    Write-Host '  Settings -> Remote Executors -> Add (the token is shown once).' -ForegroundColor DarkGray
    Write-Host '  Leave RUNNER_URL blank to skip daemon mode (inbound-only).' -ForegroundColor DarkGray
    Write-Host ''

    $urlDefault = if ($CeRunnerUrl) { $CeRunnerUrl } else { '' }
    $url = Read-Host "  RUNNER_URL (e.g. http://host:8090) [${urlDefault}, blank = skip]"
    if ([string]::IsNullOrWhiteSpace($url)) { $url = $urlDefault }
    $script:CeRunnerUrl = $url

    if ($CeRunnerUrl) {
        $idDefault = if ($CeExecutorId) { $CeExecutorId } else { '' }
        $id = Read-Host "  EXECUTOR_ID (from the agent UI) [${idDefault}]"
        if ([string]::IsNullOrWhiteSpace($id)) { $id = $idDefault }
        $script:CeExecutorId = $id

        $tokDef = if ($CeExecutorToken) { $CeExecutorToken } else { '' }
        $etok = Read-Host "  EXECUTOR_TOKEN (from the agent UI, shown once) [${tokDef}]"
        if ([string]::IsNullOrWhiteSpace($etok)) { $etok = $tokDef }
        $script:CeExecutorToken = $etok

        if ([string]::IsNullOrWhiteSpace($script:CeExecutorId) -or [string]::IsNullOrWhiteSpace($script:CeExecutorToken)) {
            Write-Warn 'Daemon mode needs both EXECUTOR_ID and EXECUTOR_TOKEN; disabling daemon mode.'
            $script:CeRunnerUrl = ''
            $script:CeExecutorId = ''
            $script:CeExecutorToken = ''
        }
    } else {
        $script:CeExecutorId = ''
        $script:CeExecutorToken = ''
    }

    Write-Host ''
    Write-Host '  Inbound mode (legacy — only needed if the agent calls this host' -ForegroundColor DarkGray
    Write-Host '  directly via POST /executor/run). Skip with Enter to use defaults.' -ForegroundColor DarkGray
    Write-Host ''

    $portDefault = if ($CePort) { $CePort } else { '8010' }
    $port = Read-Host "  SERVER_PORT [${portDefault}]"
    if ([string]::IsNullOrWhiteSpace($port)) { $port = $portDefault }
    $script:CePort = $port

    $tokenDefault = if ($CeToken) { $CeToken } else { '' }
    if ($tokenDefault) {
        $tok = Read-Host "  SPRING_APPLICATION_TOKEN (inbound /executor/run auth) [${tokenDefault}]"
        if ([string]::IsNullOrWhiteSpace($tok)) { $tok = $tokenDefault }
    } else {
        $tok = Read-Host '  SPRING_APPLICATION_TOKEN (inbound auth) [auto-generate]'
        if ([string]::IsNullOrWhiteSpace($tok)) {
            $tok = New-CliExecutorToken
            Write-Host "   Generated: $($tok.Substring(0,16))..." -ForegroundColor Green
        }
    }
    $script:CeToken = $tok
}

function Write-CliExecutorEnv {
    param([string]$InstallDir)
    $path = Join-Path $InstallDir '.env'
    $lines = @(
        "SPRING_APPLICATION_TOKEN=$CeToken",
        "SERVER_PORT=$CePort"
    )
    if ($CeRunnerUrl) {
        $lines += "RUNNER_URL=$CeRunnerUrl"
        $lines += "EXECUTOR_ID=$CeExecutorId"
        $lines += "EXECUTOR_TOKEN=$CeExecutorToken"
    }
    Set-Content -Path $path -Value $lines -Encoding ASCII
    Write-Success "Config written: $path"
    if ($CeRunnerUrl) {
        Write-Info "Daemon mode ON -> registers with $CeRunnerUrl as id=$CeExecutorId"
    } else {
        Write-Info 'Daemon mode OFF -> inbound-only (agent must reach this host)'
    }
}

# Launcher batch script. WinSW runs this via cmd.exe; it sources .env into
# the process environment then launches the jar. Edit .env + Restart-Service
# GriphookCliExecutor to change config (no .bat regen needed).
function Write-CliExecutorLauncher {
    param([string]$InstallDir)
    $bat = @(
        '@echo off',
        'rem CLI Executor launcher (generated by install.ps1).',
        'rem Sources .env into the process environment, then runs the jar.',
        'rem Edit .env + Restart-Service GriphookCliExecutor to change config.',
        'cd /d "%~dp0"',
        'for /f "usebackq tokens=1,* delims==" %%a in (".env") do set "%%a=%%b"',
        'java -jar cli-executor.jar'
    )
    $path = Join-Path $InstallDir 'cli-executor-start.bat'
    Set-Content -Path $path -Value $bat -Encoding ASCII
    Write-Success "Launcher written: $path"
}

# Copy the shared WinSW exe to a cli-executor-named copy + generate its xml.
# WinSW requires the exe + xml to share a basename.
function Install-CliExecutorWinSw {
    param([string]$SrcDir, [string]$InstallDir)

    $logDir = Join-Path $InstallDir 'logs'
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null

    $srcExe = Join-Path $SrcDir 'griphook-win-service.exe'
    if (-not (Test-Path $srcExe)) { throw "WinSW exe not found at $srcExe" }

    $exeDst = Join-Path $InstallDir 'griphook-cli-executor.exe'
    Copy-Item -Force $srcExe $exeDst

    $xml = @(
        '<service>',
        '  <id>GriphookCliExecutor</id>',
        '  <name>Griphook CLI Executor</name>',
        '  <description>GRIPHOOK remote command runner (cli-executor, daemon mode)</description>',
        '  <executable>cmd.exe</executable>',
        '  <arguments>/c "%BASE%\cli-executor-start.bat"</arguments>',
        '  <workingdirectory>%BASE%</workingdirectory>',
        '  <logpath>%BASE%\logs</logpath>',
        '  <log mode="roll-by-size">',
        '    <sizeThreshold>10240</sizeThreshold>',
        '    <keepFiles>8</keepFiles>',
        '  </log>',
        '  <startmode>Automatic</startmode>',
        '</service>'
    )
    $xmlDst = Join-Path $InstallDir 'griphook-cli-executor.xml'
    Set-Content -Path $xmlDst -Value $xml -Encoding ASCII
    Write-Success "WinSW installed: $exeDst"
}

function Stop-ExistingCliExecutorServiceForReinstall {
    $name = 'GriphookCliExecutor'
    $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
    if ($null -eq $svc) { return }
    Write-Info "Stopping existing service: $name"
    try { Stop-Service -Name $name -Force -ErrorAction Stop } catch { }
    $deadline = (Get-Date).AddSeconds(15)
    while ((Get-Date) -lt $deadline) {
        $s = Get-Service -Name $name -ErrorAction SilentlyContinue
        if ($null -eq $s) { break }
        if ($s.Status -eq 'Stopped') { break }
        Start-Sleep -Milliseconds 500
    }
    Write-Info "Deleting existing service: $name"
    & sc.exe delete $name 2>&1 | Out-Null
    Start-Sleep -Seconds 1
}

function New-CliExecutorService {
    param([string]$InstallDir)

    if (-not (Test-Path (Join-Path $InstallDir 'cli-executor.jar'))) {
        throw "cli-executor.jar not found in $InstallDir - did Build-CliExecutor succeed?"
    }

    $winswExe = Join-Path $InstallDir 'griphook-cli-executor.exe'
    $svc = Get-Service -Name 'GriphookCliExecutor' -ErrorAction SilentlyContinue
    if ($null -ne $svc) {
        Write-Info 'Removing existing GriphookCliExecutor service...'
        & $winswExe stop 2>&1 | Out-Null
        & $winswExe uninstall 2>&1 | Out-Null
        Start-Sleep -Seconds 1
    }

    Write-Info 'Creating service: GriphookCliExecutor'
    & $winswExe install 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
    if ($LASTEXITCODE -ne 0) { throw "WinSW install failed for GriphookCliExecutor (exit $LASTEXITCODE)" }
    Write-Success "Service 'GriphookCliExecutor' created"
}

function Start-CliExecutorService {
    Write-Info 'Starting GriphookCliExecutor...'
    Start-Service -Name 'GriphookCliExecutor'
    Write-Success 'Service started'
}

function Write-CliExecutorNextSteps {
    param([string]$InstallDir)

    Write-Host ''
    Write-Host '============================================' -ForegroundColor Green
    Write-Host '    CLI Executor Installation Complete      ' -ForegroundColor Green
    Write-Host '============================================' -ForegroundColor Green
    Write-Host ''
    Write-Host '  Install dir: ' -NoNewline -ForegroundColor Cyan
    Write-Host $InstallDir
    Write-Host '  Config file: ' -NoNewline -ForegroundColor Cyan
    Write-Host (Join-Path $InstallDir '.env')
    Write-Host '  Logs:        ' -NoNewline -ForegroundColor Cyan
    Write-Host (Join-Path $InstallDir 'logs')
    Write-Host ''
    Write-Host '  Service management:' -ForegroundColor Cyan
    Write-Host '    Start-Service GriphookCliExecutor'
    Write-Host '    Stop-Service  GriphookCliExecutor'
    Write-Host '    Get-Service   GriphookCliExecutor'
    Write-Host ''
    Write-Host '  To edit configuration:' -ForegroundColor Cyan
    Write-Host "    notepad $(Join-Path $InstallDir '.env')"
    Write-Host '    Restart-Service GriphookCliExecutor'
    Write-Host ''

    if ($CeRunnerUrl) {
        Write-Host '  Mode: ' -NoNewline -ForegroundColor Cyan
        Write-Host 'Daemon (calls runner-agent outbound)' -ForegroundColor Yellow
        Write-Host ''
        Write-Host '    RUNNER_URL:      ' -NoNewline -ForegroundColor Cyan
        Write-Host $CeRunnerUrl -ForegroundColor Yellow
        Write-Host '    EXECUTOR_ID:     ' -NoNewline -ForegroundColor Cyan
        Write-Host $CeExecutorId -ForegroundColor Yellow
        Write-Host '    EXECUTOR_TOKEN:  ' -NoNewline -ForegroundColor Cyan
        Write-Host $CeExecutorToken -ForegroundColor Yellow
        Write-Host ''
        Write-Host '  Check the executor is ONLINE on the runner-agent:' -ForegroundColor Cyan
        Write-Host "    curl $CeRunnerUrl/executors -H 'Authorization: Bearer <AGENT_TOKEN>'"
        Write-Host "  (look for executor id=$CeExecutorId status=ONLINE)" -ForegroundColor DarkGray
        Write-Host ''
        Write-Host '  ============================================' -ForegroundColor Green
        Write-Host '      Remote Executor (Daemon Mode)        ' -ForegroundColor Green
        Write-Host '  ============================================' -ForegroundColor Green
        Write-Host ''
        Write-Host '  EXECUTOR_TOKEN: ' -NoNewline -ForegroundColor Cyan
        Write-Host $CeExecutorToken -ForegroundColor Yellow
        Write-Host ''
        Write-Host '  The token is shown ONCE when you create the executor in the' -ForegroundColor DarkGray
        Write-Host '  agent UI. If you lose it, delete + recreate the executor there.' -ForegroundColor DarkGray
    } else {
        Write-Host '  Mode: ' -NoNewline -ForegroundColor Cyan
        Write-Host "Inbound (agent calls this host on port $CePort)" -ForegroundColor Yellow
        Write-Host ''
        Write-Host '  Health check:' -ForegroundColor Cyan
        Write-Host "    curl http://localhost:$CePort/executor/health"
        Write-Host ''
        Write-Host '  ============================================' -ForegroundColor Green
        Write-Host '         Your CLI Executor Token           ' -ForegroundColor Green
        Write-Host '  ============================================' -ForegroundColor Green
        Write-Host ''
        Write-Host '  SPRING_APPLICATION_TOKEN: ' -NoNewline -ForegroundColor Cyan
        Write-Host $CeToken -ForegroundColor Yellow
        Write-Host ''
        Write-Host '  Send this token in the POST /executor/run body (not a header).' -ForegroundColor DarkGray
    }
    Write-Host ''
    Write-Host "  Documentation: https://github.com/$GithubRepo" -ForegroundColor DarkGray
    Write-Host ''
}

function Install-CliExecutor {
    Write-Info 'Installing CLI Executor (remote command runner)...'

    Install-Java
    Install-Git

    New-Item -ItemType Directory -Force -Path $CliExecutorDir | Out-Null
    $srcDir = Join-Path $CliExecutorDir 'src'

    Get-Sources -Destination $srcDir
    Build-CliExecutor -SrcDir $srcDir -InstallDir $CliExecutorDir

    Import-CliExecutorConfig -EnvPath (Join-Path $CliExecutorDir '.env')
    Prompt-CliExecutorConfig -InstallDir $CliExecutorDir
    Write-CliExecutorEnv -InstallDir $CliExecutorDir
    Write-CliExecutorLauncher -InstallDir $CliExecutorDir

    if ($SkipServices) {
        Write-Warn 'Skipping service creation (-SkipServices set)'
    } else {
        Stop-ExistingCliExecutorServiceForReinstall
        Install-CliExecutorWinSw -SrcDir $srcDir -InstallDir $CliExecutorDir
        New-CliExecutorService -InstallDir $CliExecutorDir
        Start-CliExecutorService
    }

    Write-CliExecutorNextSteps -InstallDir $CliExecutorDir
}

# -- Main -------------------------------------------------------------------
function Main {
    Write-Banner
    Assert-Admin
    Assert-Winget

    # Top-level product choice. -CliExecutor skips the prompt.
    $installCliExecutor = [bool]$CliExecutor
    if (-not $installCliExecutor) {
        Write-Host ''
        Write-Host 'What would you like to install?' -ForegroundColor Cyan
        Write-Host ''
        Write-Host '  1) GRIPHOOK       - the full agent + control center UI' -ForegroundColor White
        Write-Host '  2) CLI Executor   - remote command runner (connects to a GRIPHOOK agent)' -ForegroundColor White
        Write-Host ''
        $ans = Read-Host 'Enter choice [1, 2] (default 1)'
        if ($ans -eq '2') { $installCliExecutor = $true }
    }

    if ($installCliExecutor) {
        Install-CliExecutor
        return
    }

    Install-Java
    if (-not $SkipUI) { Install-Node }
    Install-Git

    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    $srcDir = Join-Path $InstallDir 'src'

    Get-Sources -Destination $srcDir
    Build-Backend  -SrcDir $srcDir -InstallDir $InstallDir
    if ($SkipUI) {
        Write-Warn 'Skipping frontend build (-SkipUI set): installing agent only'
    } else {
        Build-Frontend -SrcDir $srcDir -InstallDir $InstallDir
    }

    # Import existing launcher .bat config (if re-run) so prompts default
    # to the user's current values, then prompt for all config + write
    # the launcher .bat. No .env file - all config baked into the .bat.
    Import-CredsFromLauncher -LauncherPath (Join-Path $InstallDir 'griphook-start.bat')
    Prompt-Config -InstallDir $InstallDir

    if ($SkipServices) {
        Write-Warn 'Skipping service creation (-SkipServices set)'
    } else {
        # Stop + delete any existing Griphook services BEFORE copying the
        # WinSW exes, so a running service can't lock the file.
        Stop-ExistingServicesForReinstall
        Install-WinSw -SrcDir $srcDir -InstallDir $InstallDir
        New-BackendService  -InstallDir $InstallDir
        if (-not $SkipUI) {
            New-FrontendService -InstallDir $InstallDir
        }
        Start-Services
    }

    Write-NextSteps -InstallDir $InstallDir -AgentOnly:$SkipUI
}

# Keep the window open so the user can read/copy the token + next steps.
# install.ps1 prints the agent token at the very end of Write-NextSteps;
# without this pause the window closes immediately when run via the
# `irm | iex` one-liner (or via install.bat, where the child PowerShell
# process exits before install.bat's own pause fires). Skipped with
# -NoPause for CI / automation.
function Wait-BeforeExit {
    if ($NoPause) { return }
    Write-Host ''
    Write-Host 'Press Enter to exit...' -ForegroundColor DarkGray
    try { [void](Read-Host) } catch { }
}

try {
    Main
    Wait-BeforeExit
} catch {
    Write-Host ''
    Write-Err $_.Exception.Message
    Write-Host ''
    Write-Host '  Installation failed. See the error above.' -ForegroundColor Yellow
    Write-Host "  For help, open an issue at: https://github.com/$GithubRepo/issues" -ForegroundColor Yellow
    Write-Host ''
    Wait-BeforeExit
    exit 1
}
