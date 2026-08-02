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
.PARAMETER SkipPostgres
    Skip the PostgreSQL db/user initialization + the manual-install
    instructions. The installer does NOT install PostgreSQL for you -
    install it separately (see the printed instructions). Use this switch
    only if you have already set up Postgres + the runner/runner db/user
    yourself, or if you configure SPRING_DATASOURCE_* in .env manually.
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
    [switch]$SkipPostgres
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

# -- PostgreSQL --------------------------------------------------------------
# The backend is Postgres-only (see application.yml). The installer does NOT
# install PostgreSQL for you - install it manually first (winget one-liner
# below), then this installer creates the runner/runner db+user the app
# defaults to (SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/runner,
# _USERNAME=runner, _PASSWORD=runner). If psql is not on PATH when this
# installer runs, it prints manual instructions + skips db init (the backend
# service will fail to start until you install Postgres + re-run).
$RequiredPgVer = 16
$PgSuperPassword = 'postgres'
$PgAppDb    = 'runner'
$PgAppUser  = 'runner'
$PgAppPass  = 'runner'
$PgPort     = 5432

function Write-PostgresInstructions {
    Write-Host ''
    Write-Host '  PostgreSQL required (not installed / psql not on PATH)' -ForegroundColor Yellow
    Write-Host '  The backend is Postgres-only. Install it, then re-run this installer.' -ForegroundColor DarkGray
    Write-Host ''
    Write-Host '  Option A - winget (elevated PowerShell):' -ForegroundColor Cyan
    Write-Host "    winget install -e --id PostgreSQL.PostgreSQL.$RequiredPgVer --override `"--mode unattended --superpassword $PgSuperPassword --serverport $PgPort`""
    Write-Host ''
    Write-Host '  Option B - download the installer:' -ForegroundColor Cyan
    Write-Host '    https://www.postgresql.org/download/windows/'
    Write-Host ''
    Write-Host '  After install, open a NEW terminal (so PATH refreshes) + re-run:' -ForegroundColor Cyan
    Write-Host '    install.bat'
    Write-Host ''
    Write-Host "  The installer will then create the '$PgAppUser' role + '$PgAppDb' database the backend expects." -ForegroundColor DarkGray
    Write-Host ''
}

# If .env already exists with SPRING_DATASOURCE_* (e.g. user re-running the
# installer, or hand-edited .env), import those into the script-scope vars so
# Initialize-PostgresDb creates/uses the right db+user instead of defaults.
function Import-PgCredsFromEnv {
    param([string]$EnvFile)
    if (-not (Test-Path $EnvFile)) { return }
    foreach ($l in Get-Content $EnvFile) {
        if ($l -match '^\s*SPRING_DATASOURCE_URL\s*=\s*(.+)$') {
            $url = $matches[1].Trim()
            # jdbc:postgresql://localhost:5432/<db>  -> extract <db>
            if ($url -match '/([^/]+)$') { $script:PgAppDb = $matches[1] }
        }
        elseif ($l -match '^\s*SPRING_DATASOURCE_USERNAME\s*=\s*(.+)$') {
            $script:PgAppUser = $matches[1].Trim()
        }
        elseif ($l -match '^\s*SPRING_DATASOURCE_PASSWORD\s*=\s*(.+)$') {
            $script:PgAppPass = $matches[1].Trim()
        }
    }
}

# Wait until Postgres accepts connections (psql probe).
function Wait-PostgresReady {
    $psql = Resolve-OnPath 'psql'
    if (-not $psql) { throw "psql not on PATH - cannot probe Postgres readiness" }
    $env:PGPASSWORD = $PgSuperPassword
    $deadline = (Get-Date).AddSeconds(60)
    while ((Get-Date) -lt $deadline) {
        $out = & $psql -h localhost -p $PgPort -U postgres -tAc "SELECT 1" 2>&1
        if ($LASTEXITCODE -eq 0 -and "$out".Trim() -eq '1') {
            Remove-Item Env:PGPASSWORD
            return
        }
        Start-Sleep -Seconds 2
    }
    Remove-Item Env:PGPASSWORD
    throw "Postgres did not become ready within 60s"
}

# Create the app db + user (idempotent). Only runs when psql is on PATH.
# Uses the script-scope $PgAppDb/$PgAppUser/$PgAppPass/$PgSuperPassword vars
# (defaults or overridden by Write-EnvFile prompts). Validates db/user names
# as simple identifiers + escapes the password for SQL string literals.
function Initialize-PostgresDb {
    $psql = Resolve-OnPath 'psql'
    if (-not $psql) {
        Write-PostgresInstructions
        return
    }

    # Validate db + user names as simple SQL identifiers to avoid injection
    # through identifier positions (CREATE ROLE <name>, CREATE DATABASE <name>).
    foreach ($n in @($PgAppDb, $PgAppUser)) {
        if ($n -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
            throw "Invalid PostgreSQL identifier '$n' - use letters, digits, underscore, starting with a letter/underscore."
        }
    }
    # Escape single quotes in the password for the SQL string literal.
    $pgPassEsc = $PgAppPass -replace "'", "''"

    Write-Info 'Initializing PostgreSQL database...'
    Wait-PostgresReady

    # Show the user exactly what we're about to run (creds redacted).
    Write-Host '  SQL to run (as superuser "postgres"):' -ForegroundColor DarkGray
    Write-Host '    DO $$ BEGIN' -ForegroundColor DarkGray
    Write-Host '      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ''' -NoNewline -ForegroundColor DarkGray
    Write-Host $PgAppUser -NoNewline -ForegroundColor Cyan
    Write-Host ''') THEN' -ForegroundColor DarkGray
    Write-Host '        CREATE ROLE ' -NoNewline -ForegroundColor DarkGray
    Write-Host $PgAppUser -NoNewline -ForegroundColor Cyan
    Write-Host ' WITH LOGIN PASSWORD ''<redacted>'';' -ForegroundColor DarkGray
    Write-Host '      END IF;' -ForegroundColor DarkGray
    Write-Host '    END $$;' -ForegroundColor DarkGray
    Write-Host '    CREATE DATABASE ' -NoNewline -ForegroundColor DarkGray
    Write-Host $PgAppDb -NoNewline -ForegroundColor Cyan
    Write-Host ' OWNER ' -NoNewline -ForegroundColor DarkGray
    Write-Host $PgAppUser -ForegroundColor Cyan
    Write-Host '  (skipped if database already exists)' -ForegroundColor DarkGray

    $env:PGPASSWORD = $PgSuperPassword
    try {
        # 1. Create the app role (idempotent via DO block). Regular
        #    single-quoted multi-line string (NOT a here-string, which
        #    needs CRLF and breaks when the wrapper downloads LF line
        #    endings). $$ is literal in single-quoted strings.
        $roleSql = 'DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ''__PGUSER__'') THEN
    CREATE ROLE __PGUSER__ WITH LOGIN PASSWORD ''__PGPASS__'';
  END IF;
END $$;'
        $roleSql = $roleSql.Replace('__PGUSER__', $PgAppUser).Replace('__PGPASS__', $pgPassEsc)
        $roleFile = Join-Path $env:TEMP 'griphook-pg-role.sql'
        Set-Content -Path $roleFile -Value $roleSql -Encoding ASCII
        & $psql -h localhost -p $PgPort -U postgres -f $roleFile 2>&1 |
            ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
        Remove-Item -Force $roleFile -ErrorAction SilentlyContinue
        Write-Success "Role '$PgAppUser' ready (created or already existed)"

        # 2. Create database if it doesn't exist (CREATE DATABASE can't run
        #    inside a transaction/DO block, so probe + create).
        $exists = (& $psql -h localhost -p $PgPort -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$PgAppDb'").Trim()
        if ($exists -ne '1') {
            & $psql -h localhost -p $PgPort -U postgres -c "CREATE DATABASE $PgAppDb OWNER $PgAppUser" 2>&1 |
                ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
            Write-Success "Created database '$PgAppDb' (owner: $PgAppUser)"
        } else {
            Write-Success "Database '$PgAppDb' already exists"
        }
    } finally {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
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

function Write-EnvFile {
    param([string]$InstallDir)

    $envPath = Join-Path $InstallDir '.env'

    # PG prompt block - shown on first install AND on re-runs. Defaults come
    # from script-scope vars seeded by Import-PgCredsFromEnv (existing .env
    # values) or the hardcoded defaults if .env doesn't exist yet.
    $showPg = {
        Write-Host ''
        Write-Host '4. PostgreSQL (the backend is Postgres-only)'
        Write-Host '   The installer creates a database + login role the backend will use.' -ForegroundColor DarkGray
        Write-Host '   You must have already installed PostgreSQL (see the printed instructions if not).' -ForegroundColor DarkGray
        Write-Host "   Superuser password [${PgSuperPassword}]:" -NoNewline
        Write-Host ' (used to connect as postgres + create the app role/db)' -ForegroundColor DarkGray
        $pgSuper = Read-Host "   Enter PostgreSQL superuser (postgres) password [${PgSuperPassword}]"
        if ([string]::IsNullOrWhiteSpace($pgSuper)) { $pgSuper = $PgSuperPassword }
        $script:PgSuperPassword = $pgSuper

        $pgDb = Read-Host "   Enter app database name [${PgAppDb}]"
        if ([string]::IsNullOrWhiteSpace($pgDb)) { $pgDb = $PgAppDb }
        $script:PgAppDb = $pgDb

        $pgUser = Read-Host "   Enter app user name [${PgAppUser}]"
        if ([string]::IsNullOrWhiteSpace($pgUser)) { $pgUser = $PgAppUser }
        $script:PgAppUser = $pgUser

        $pgPass = Read-Host "   Enter app user password [${PgAppPass}]"
        if ([string]::IsNullOrWhiteSpace($pgPass)) { $pgPass = $PgAppPass }
        $script:PgAppPass = $pgPass
    }

    if (Test-Path $envPath) {
        Write-Info ".env already exists at $envPath - keeping token/apiKey/port"
        Write-Host '   Re-prompting PostgreSQL credentials (defaults = current .env values).' -ForegroundColor DarkGray
        & $showPg
        # Rewrite just the SPRING_DATASOURCE_* lines in the existing file
        # so we preserve AGENT_TOKEN / GOOGLE_AI_API_KEY / etc.
        $pgUrl = "SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:${PgPort}/${PgAppDb}"
        $pgU   = "SPRING_DATASOURCE_USERNAME=${PgAppUser}"
        $pgP   = "SPRING_DATASOURCE_PASSWORD=${PgAppPass}"
        $out = @()
        $sawUrl = $false; $sawU = $false; $sawP = $false
        foreach ($l in Get-Content $envPath) {
            if ($l -match '^\s*SPRING_DATASOURCE_URL\s*=') { $out += $pgUrl; $sawUrl = $true }
            elseif ($l -match '^\s*SPRING_DATASOURCE_USERNAME\s*=') { $out += $pgU; $sawU = $true }
            elseif ($l -match '^\s*SPRING_DATASOURCE_PASSWORD\s*=') { $out += $pgP; $sawP = $true }
            else { $out += $l }
        }
        if (-not $sawUrl) { $out += $pgUrl }
        if (-not $sawU)   { $out += $pgU }
        if (-not $sawP)   { $out += $pgP }
        Set-Content -Path $envPath -Value $out -Encoding ASCII
        Write-Success "PostgreSQL credentials updated: ${envPath}"
        return
    }

    Write-Host ''
    Write-Host '============================================' -ForegroundColor Cyan
    Write-Host '         Quick Configuration                ' -ForegroundColor Cyan
    Write-Host '============================================' -ForegroundColor Cyan
    Write-Host ''
    Write-Host '1. Google AI API Key ' -NoNewline
    Write-Host '(required for AI chat)' -ForegroundColor Red
    Write-Host '   Get your free key at: https://aistudio.google.com/apikey' -ForegroundColor DarkGray
    $apiKey = Read-Host '   Enter your Google AI API Key (or blank to skip)'

    Write-Host ''
    Write-Host '2. Agent Token (API authentication)'
    Write-Host '   Press Enter to auto-generate a secure token.' -ForegroundColor DarkGray
    $token = Read-Host '   Enter Agent Token'
    if ([string]::IsNullOrWhiteSpace($token)) {
        $token = New-AgentToken
        Write-Host "   Generated: $($token.Substring(0,16))..." -ForegroundColor Green
    }

    Write-Host ''
    Write-Host '3. Server Port (Default: 8090)'
    Write-Host '   If the default is in use, we will auto-bump by +100 until a free port is found.' -ForegroundColor DarkGray
    $port = Read-Host '   Enter Server Port [8090]'
    if ([string]::IsNullOrWhiteSpace($port)) { $port = '8090' }
    $portInt = [int]$port
    $suggestedPort = Find-FreePort -StartPort $portInt
    if ($suggestedPort -ne $portInt) {
        Write-Warn "Port $portInt is in use. Using $suggestedPort instead."
        $portInt = $suggestedPort
    }
    $port = "$portInt"

    & $showPg

    $generatedAt = Get-Date -Format 'yyyy-MM-dd HH:mm'
    $tempDir = $env:TEMP
    $lines = @(
        "# GRIPHOOK Configuration (generated ${generatedAt})",
        "AGENT_TOKEN=${token}",
        "GOOGLE_AI_API_KEY=${apiKey}",
        "",
        "SERVER_PORT=${port}",
        "AGENT_WORKING_DIR=${tempDir}",
        "AGENT_DEFAULT_SHELL=cmd.exe",
        "AGENT_MAX_CONCURRENT=5",
        "",
        "AGENT_ADK_MODEL=gemini-2.0-flash",
        "AGENT_ADK_ENABLED=true",
        "",
        "# PostgreSQL (the backend defaults to these via application.yml)",
        "SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:${PgPort}/${PgAppDb}",
        "SPRING_DATASOURCE_USERNAME=${PgAppUser}",
        "SPRING_DATASOURCE_PASSWORD=${PgAppPass}"
    )
    Set-Content -Path $envPath -Value $lines -Encoding ASCII
    Write-Success "Configuration saved: ${envPath}"
}

# -- Service wrappers (WinSW) ------------------------------------------------
# A single WinSW binary (griphook-win-service.exe) is committed at the repo
# root + copied into the install dir under two names - one per service - so
# WinSW's exe+xml-same-basename convention is satisfied for both the backend
# and the UI without shipping the 18 MB binary twice. The xml templates carry
# __JAVA_EXE__ / __NODE_EXE__ / __ENV_VARS__ tokens replaced at install time.
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

# Build <env name="X" value="Y"/> lines from the install dir .env file.
# Skips comments + blank lines. XML-escapes values.
function ConvertTo-WinSwEnvLines {
    param([string]$EnvFile)

    if (-not (Test-Path $EnvFile)) { return @() }
    $lines = Get-Content $EnvFile |
        Where-Object { $_ -match '^\s*[^#\s][^=]*=' } |
        ForEach-Object { $_.Trim() }
    $out = @()
    foreach ($l in $lines) {
        $idx = $l.IndexOf('=')
        if ($idx -le 0) { continue }
        $k = $l.Substring(0, $idx).Trim()
        $v = $l.Substring($idx + 1)
        $vEsc = $v -replace '&','&amp;' -replace '<','&lt;' -replace '>','&gt;' -replace '"','&quot;'
        $out += "  <env name=`"$k`" value=`"$vEsc`"/>"
    }
    return $out
}

# Render a WinSW xml template: replace __JAVA_EXE__ / __NODE_EXE__ / __ENV_VARS__.
function Write-WinSwXml {
    param(
        [string]$TemplatePath,
        [string]$OutPath,
        [string]$JavaExe,
        [string]$NodeExe,
        [string[]]$EnvLines
    )
    $xml = Get-Content -Raw $TemplatePath
    # Use literal .Replace() - -replace would treat $ in paths/values as
    # backreferences and backslash as regex escape.
    $envBlock = ($EnvLines -join "`n")
    $xml = $xml.Replace('__JAVA_EXE__', $JavaExe)
    $xml = $xml.Replace('__NODE_EXE__', $NodeExe)
    $xml = $xml.Replace('__ENV_VARS__', $envBlock)
    Set-Content -Path $OutPath -Value $xml -Encoding ASCII
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

    $winswExe = Join-Path $InstallDir 'griphook-win-service.exe'
    $xmlTpl   = Join-Path $InstallDir 'griphook-win-service.xml'
    $envFile  = Join-Path $InstallDir '.env'
    $envLines = ConvertTo-WinSwEnvLines -EnvFile $envFile

    Write-WinSwXml -TemplatePath $xmlTpl -OutPath $xmlTpl `
        -JavaExe $javaExe -NodeExe '' -EnvLines $envLines

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

    $winswExe = Join-Path $InstallDir 'griphook-win-service-ui.exe'
    $xmlTpl   = Join-Path $InstallDir 'griphook-win-service-ui.xml'
    $envFile  = Join-Path $InstallDir '.env'
    $envLines = ConvertTo-WinSwEnvLines -EnvFile $envFile

    Write-WinSwXml -TemplatePath $xmlTpl -OutPath $xmlTpl `
        -JavaExe '' -NodeExe $nodeExe -EnvLines $envLines

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
    Write-Host (Join-Path $InstallDir '.env')
    Write-Host '  Logs:        ' -NoNewline -ForegroundColor Cyan
    Write-Host (Join-Path $InstallDir 'logs')
    Write-Host ''
    Write-Host '  Database (PostgreSQL):' -ForegroundColor Cyan
    if (Resolve-OnPath 'psql') {
        Write-Host "    Connect:    jdbc:postgresql://localhost:$PgPort/$PgAppDb"
        Write-Host "    App user:   $PgAppUser  (password: $PgAppPass)"
        Write-Host "    Superuser:  postgres   (password: $PgSuperPassword)"
    } else {
        Write-Host "    NOT installed - backend will fail to start until you install Postgres" -ForegroundColor Yellow
        Write-Host "    Install (elevated PowerShell):" -ForegroundColor Cyan
        Write-Host "      winget install -e --id PostgreSQL.PostgreSQL.$RequiredPgVer --override `"--mode unattended --superpassword $PgSuperPassword --serverport $PgPort`""
        Write-Host "    Then re-run: install.bat" -ForegroundColor Cyan
    }
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
    Write-Host "    notepad $(Join-Path $InstallDir '.env')"
    Write-Host "    Restart-Service $BackendServiceName"
    Write-Host ''
    Write-Host "  Documentation: https://github.com/$GithubRepo" -ForegroundColor DarkGray
    Write-Host ''

    # Show the agent token so the user can copy it (read back from .env so it
    # works even when config was skipped because .env already existed).
    $envFile = Join-Path $InstallDir '.env'
    if (Test-Path $envFile) {
        $savedToken = $null
        $savedPort  = $null
        Get-Content $envFile | ForEach-Object {
            if ($_ -match '^AGENT_TOKEN=(.*)$') { $savedToken = $matches[1] }
            if ($_ -match '^SERVER_PORT=(.*)$') { $savedPort  = $matches[1] }
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

# -- Main -------------------------------------------------------------------
function Main {
    Write-Banner
    Assert-Admin
    Assert-Winget

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

    # If .env was pre-existing (re-run) or hand-edited, import its
    # SPRING_DATASOURCE_* BEFORE Write-EnvFile so the PG prompts below
    # default to whatever the user already set up.
    Import-PgCredsFromEnv -EnvFile (Join-Path $InstallDir '.env')

    Write-EnvFile -InstallDir $InstallDir

    # Create the runner/runner db+user the backend defaults to. The installer
    # does NOT install PostgreSQL itself - if psql is not on PATH, this prints
    # manual install instructions + skips (the backend service will fail to
    # start until you install Postgres + re-run). Skip with -SkipPostgres to
    # suppress the instructions (you manage Postgres yourself).
    if (-not $SkipPostgres) { Initialize-PostgresDb }

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

try {
    Main
} catch {
    Write-Host ''
    Write-Err $_.Exception.Message
    Write-Host ''
    Write-Host '  Installation failed. See the error above.' -ForegroundColor Yellow
    Write-Host "  For help, open an issue at: https://github.com/$GithubRepo/issues" -ForegroundColor Yellow
    Write-Host ''
    exit 1
}
