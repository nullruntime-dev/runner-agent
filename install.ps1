#Requires -Version 5.1
<#
.SYNOPSIS
    GRIPHOOK Windows Installer
.DESCRIPTION
    Installs GRIPHOOK (AI-Powered Deployment Agent) on Windows.
    Handles Java 21, Node.js, Git, builds backend + UI, and registers
    Windows services via NSSM.
.PARAMETER Method
    Installation method: source (default, only supported method on Windows).
.PARAMETER InstallDir
    Install location (default: C:\ProgramData\Griphook).
.PARAMETER SkipServices
    Skip Windows service creation (run manually instead).
.EXAMPLE
    irm https://griphook.dev/install.ps1 | iex
#>

[CmdletBinding()]
param(
    [ValidateSet('source')]
    [string]$Method = 'source',
    [string]$InstallDir = "${env:ProgramData}\Griphook",
    [switch]$SkipServices
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
# NOTE: we do NOT check $LASTEXITCODE because it leaks in from prior pipelines
# (e.g. winget install | Out-Null). We just inspect the output directly.
function Resolve-OnPath {
    param([string]$Name)
    $output = & where.exe $Name 2>$null
    if (-not $output) { return $null }
    $first = @($output)[0]
    if ([string]::IsNullOrWhiteSpace($first)) { return $null }
    return $first.Trim()
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
}z

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

        # Write UI env before build (Prisma needs DATABASE_URL)
        Set-Content -Path (Join-Path $uiDest '.env.local') -Value 'DATABASE_URL="file:./agents.db"' -Encoding ASCII

        Write-Info 'Generating Prisma client...'
        & cmd.exe /c 'npx --yes prisma generate 2>&1' | Out-Null
        & cmd.exe /c 'npx --yes prisma db push --accept-data-loss 2>&1' | Out-Null

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
function New-AgentToken {
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [BitConverter]::ToString($bytes).Replace('-', '').ToLower()
}

function Write-EnvFile {
    param([string]$InstallDir)

    $envPath = Join-Path $InstallDir '.env'
    if (Test-Path $envPath) {
        Write-Info ".env already exists at $envPath - leaving it untouched"
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
    $port = Read-Host '3. Server Port [8090]'
    if ([string]::IsNullOrWhiteSpace($port)) { $port = '8090' }

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
        "AGENT_ADK_ENABLED=true"
    )
    Set-Content -Path $envPath -Value $lines -Encoding ASCII
    Write-Success "Configuration saved: ${envPath}"
}

# -- Service wrappers (NSSM) ------------------------------------------------
# nssm.exe is committed at the repo root and copied in from the cloned source.
function Install-Nssm {
    param([string]$SrcDir, [string]$InstallDir)

    $nssmExe = Join-Path $InstallDir 'nssm.exe'
    $nssmSrc = Join-Path $SrcDir 'nssm.exe'
    if (-not (Test-Path $nssmSrc)) {
        throw "nssm.exe not found in cloned repo at $nssmSrc"
    }
    Copy-Item -Force $nssmSrc $nssmExe
    Write-Success "NSSM installed: $nssmExe"
    return $nssmExe
}

function Remove-ExistingService {
    param([string]$Nssm, [string]$Name)

    $svc = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if ($null -ne $svc) {
        Write-Info "Removing existing service: $Name"
        & $Nssm stop $Name confirm 2>&1 | Out-Null
        & $Nssm remove $Name confirm 2>&1 | Out-Null
        Start-Sleep -Seconds 1
    }
}

function New-BackendService {
    param([string]$Nssm, [string]$InstallDir)

    $javaExe = Resolve-OnPath 'java'
    if (-not $javaExe) { throw "java not found on PATH when creating backend service" }
    $jar     = Join-Path $InstallDir 'griphook-agent.jar'
    $logDir  = Join-Path $InstallDir 'logs'
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null

    Remove-ExistingService -Nssm $Nssm -Name $BackendServiceName

    Write-Info "Creating service: $BackendServiceName"
    & $Nssm install $BackendServiceName $javaExe "-Xmx512m" "-jar" $jar | Out-Null
    & $Nssm set $BackendServiceName AppDirectory $InstallDir | Out-Null
    & $Nssm set $BackendServiceName AppStdout (Join-Path $logDir 'griphook.out.log') | Out-Null
    & $Nssm set $BackendServiceName AppStderr (Join-Path $logDir 'griphook.err.log') | Out-Null
    & $Nssm set $BackendServiceName AppRotateFiles 1 | Out-Null
    & $Nssm set $BackendServiceName AppRotateBytes 10485760 | Out-Null
    & $Nssm set $BackendServiceName Start SERVICE_AUTO_START | Out-Null
    & $Nssm set $BackendServiceName Description 'GRIPHOOK AI-Powered Deployment Agent (backend)' | Out-Null

    # Load env vars from .env into the service environment
    $envFile = Join-Path $InstallDir '.env'
    if (Test-Path $envFile) {
        $envLines = Get-Content $envFile |
            Where-Object { $_ -match '^\s*[^#\s][^=]*=' } |
            ForEach-Object { $_.Trim() }
        if ($envLines) {
            & $Nssm set $BackendServiceName AppEnvironmentExtra $envLines | Out-Null
        }
    }

    Write-Success "Backend service '$BackendServiceName' created"
}

function New-FrontendService {
    param([string]$Nssm, [string]$InstallDir)

    $uiDir = Join-Path $InstallDir 'ui'
    $nodeExe = Resolve-OnPath 'node'
    if (-not $nodeExe) { throw "node not found on PATH when creating frontend service" }
    $logDir = Join-Path $InstallDir 'logs'
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null

    # npm start invokes `next start`. We call node against the next binary
    # so NSSM tracks the real process instead of an intermediate shell.
    $nextBin = Join-Path $uiDir 'node_modules\next\dist\bin\next'
    if (-not (Test-Path $nextBin)) {
        throw "Next.js binary not found at $nextBin - did 'npm install' succeed?"
    }

    Remove-ExistingService -Nssm $Nssm -Name $FrontendServiceName

    Write-Info "Creating service: $FrontendServiceName"
    & $Nssm install $FrontendServiceName $nodeExe $nextBin 'start' '-p' '3000' | Out-Null
    & $Nssm set $FrontendServiceName AppDirectory $uiDir | Out-Null
    & $Nssm set $FrontendServiceName AppStdout (Join-Path $logDir 'griphook-ui.out.log') | Out-Null
    & $Nssm set $FrontendServiceName AppStderr (Join-Path $logDir 'griphook-ui.err.log') | Out-Null
    & $Nssm set $FrontendServiceName AppRotateFiles 1 | Out-Null
    & $Nssm set $FrontendServiceName AppRotateBytes 10485760 | Out-Null
    & $Nssm set $FrontendServiceName Start SERVICE_AUTO_START | Out-Null
    & $Nssm set $FrontendServiceName Description 'GRIPHOOK UI Dashboard' | Out-Null
    & $Nssm set $FrontendServiceName AppEnvironmentExtra 'NODE_ENV=production' 'PORT=3000' | Out-Null
    & $Nssm set $FrontendServiceName DependOnService $BackendServiceName | Out-Null

    Write-Success "Frontend service '$FrontendServiceName' created"
}

function Start-Services {
    Write-Info "Starting $BackendServiceName..."
    Start-Service -Name $BackendServiceName
    Write-Info "Starting $FrontendServiceName..."
    Start-Service -Name $FrontendServiceName
    Write-Success 'Services started'
}

# -- Summary ----------------------------------------------------------------
function Write-NextSteps {
    param([string]$InstallDir)

    Write-Host ''
    Write-Host '============================================' -ForegroundColor Green
    Write-Host '         Installation Complete!             ' -ForegroundColor Green
    Write-Host '============================================' -ForegroundColor Green
    Write-Host ''
    Write-Host '  Dashboard:' -NoNewline -ForegroundColor Cyan
    Write-Host '  http://localhost:3000'
    Write-Host '  API:      ' -NoNewline -ForegroundColor Cyan
    Write-Host '  http://localhost:8090'
    Write-Host '  Health:   ' -NoNewline -ForegroundColor Cyan
    Write-Host '  http://localhost:8090/health'
    Write-Host ''
    Write-Host '  Install dir: ' -NoNewline -ForegroundColor Cyan
    Write-Host $InstallDir
    Write-Host '  Config file: ' -NoNewline -ForegroundColor Cyan
    Write-Host (Join-Path $InstallDir '.env')
    Write-Host '  Logs:        ' -NoNewline -ForegroundColor Cyan
    Write-Host (Join-Path $InstallDir 'logs')
    Write-Host ''
    Write-Host '  Service management:' -ForegroundColor Cyan
    Write-Host "    Start-Service $BackendServiceName, $FrontendServiceName"
    Write-Host "    Stop-Service  $BackendServiceName, $FrontendServiceName"
    Write-Host "    Get-Service   $BackendServiceName, $FrontendServiceName"
    Write-Host ''
    Write-Host '  To edit configuration:' -ForegroundColor Cyan
    Write-Host "    notepad $(Join-Path $InstallDir '.env')"
    Write-Host "    Restart-Service $BackendServiceName"
    Write-Host ''
    Write-Host "  Documentation: https://github.com/$GithubRepo" -ForegroundColor DarkGray
    Write-Host ''
}

# -- Main -------------------------------------------------------------------
function Main {
    Write-Banner
    Assert-Admin
    Assert-Winget

    Install-Java
    Install-Node
    Install-Git

    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    $srcDir = Join-Path $InstallDir 'src'

    Get-Sources -Destination $srcDir
    Build-Backend  -SrcDir $srcDir -InstallDir $InstallDir
    Build-Frontend -SrcDir $srcDir -InstallDir $InstallDir

    Write-EnvFile -InstallDir $InstallDir

    if ($SkipServices) {
        Write-Warn 'Skipping service creation (-SkipServices set)'
    } else {
        $nssm = Install-Nssm -SrcDir $srcDir -InstallDir $InstallDir
        New-BackendService  -Nssm $nssm -InstallDir $InstallDir
        New-FrontendService -Nssm $nssm -InstallDir $InstallDir
        Start-Services
    }

    Write-NextSteps -InstallDir $InstallDir
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
