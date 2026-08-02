@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1

REM ============================================================================
REM   GRIPHOOK Windows Installer
REM   https://griphook.dev  |  https://github.com/nullruntime-dev/runner-agent
REM
REM   This batch file is a thin wrapper around install.ps1. It exists because:
REM     - Double-clicking a .ps1 doesn't trigger UAC elevation by default
REM     - PowerShell execution policy often blocks .ps1 files downloaded
REM       from the internet ("not digitally signed" error)
REM     - Batch files bypass both problems
REM
REM   Usage:
REM     install.bat                   Interactive install (default options)
REM     install.bat -SkipUI           Agent-only: don't install the Control Center
REM     install.bat -SkipServices     Don't register Windows services
REM     install.bat -InstallDir DIR   Custom install directory
REM     install.bat -NoPause          Don't pause for keypress at the end
REM     install.bat -Help             Show this help
REM
REM   Any extra args are forwarded to install.ps1.
REM ============================================================================

set "SCRIPT_URL=https://griphook.dev/install.ps1"
set "TEMP_PS1=%TEMP%\griphook-install-%RANDOM%-%RANDOM%.ps1"
set "NO_PAUSE=0"

REM ---- ANSI helpers (Windows 10+ supports ANSI via cmd) ----------------------
REM Use a one-shot PowerShell to set the ESC var with a real escape character.
for /F "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "Write-Host -NoNewline ([char]27)"`) do set "ESC=%%i"
set "C_RESET=%ESC%[0m"
set "C_BOLD=%ESC%[1m"
set "C_DIM=%ESC%[2m"
set "C_RED=%ESC%[91m"
set "C_GREEN=%ESC%[92m"
set "C_YELLOW=%ESC%[93m"
set "C_BLUE=%ESC%[94m"
set "C_MAGENTA=%ESC%[95m"
set "C_CYAN=%ESC%[96m"

REM ---- Step printer -----------------------------------------------------------
set "STEP=0"
goto :main

:printStep
set /a STEP+=1
echo %C_DIM%[%STEP%/%~1]%C_RESET% %C_BOLD%%~2%C_RESET%
goto :eof

REM ---- Help -------------------------------------------------------------------
:main
if /I "%~1"=="-Help" goto :showHelp
if /I "%~1"=="--Help" goto :showHelp
if /I "%~1"=="/?" goto :showHelp

REM ---- Banner -----------------------------------------------------------------
cls >nul 2>&1
echo.
echo   %C_CYAN%GRIPHOOK%C_RESET%
echo   %C_DIM%AI-Powered Deployment Agent for Windows%C_RESET%
echo.
echo   %C_DIM%─────────────────────────────────────────%C_RESET%
echo.

REM ---- 1. Admin check ---------------------------------------------------------
call :printStep 4 "Checking Administrator privileges"
net session >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   %C_RED%[FAIL]%C_RESET% This installer must run as %C_BOLD%Administrator%C_RESET%.
    echo.
    echo   Right-click %C_CYAN%install.bat%C_RESET% and choose "Run as administrator".
    echo.
    pause
    exit /b 1
)
echo   %C_GREEN%[ OK ]%C_RESET% Running as Administrator
echo.

REM ---- 2. Show what we're about to do ----------------------------------------
call :printStep 4 "What this installer will do"
echo   %C_DIM%1.%C_RESET% Download %C_CYAN%install.ps1%C_RESET% from %C_DIM%%SCRIPT_URL%%C_RESET%
echo   %C_DIM%2.%C_RESET% Verify the file is non-empty
echo   %C_DIM%3.%C_RESET% Run it with %C_DIM%-ExecutionPolicy Bypass%C_RESET% and forward all args
echo   %C_DIM%4.%C_RESET% Clean up the downloaded file
echo.

REM ---- 3. Parse args (so we can echo them) ----------------------------------
set "FORWARD_ARGS="
set "NO_PAUSE=0"
:parseArgs
if "%~1"=="" goto :doneParse
if /I "%~1"=="-NoPause" (
    set "NO_PAUSE=1"
    shift
    goto :parseArgs
)
if /I "%~1"=="-Help" goto :showHelp
if /I "%~1"=="--Help" goto :showHelp
set "FORWARD_ARGS=!FORWARD_ARGS! %~1"
shift
goto :parseArgs
:doneParse

if not "%FORWARD_ARGS%"=="" (
    echo   %C_DIM%Forwarded args:%C_RESET% %C_CYAN%%FORWARD_ARGS%%C_RESET%
)
echo.

REM ---- 4. Download install.ps1 -----------------------------------------------
call :printStep 4 "Downloading installer"
echo   %C_DIM%Source:%C_RESET% %SCRIPT_URL%
echo   %C_DIM%Target:%C_RESET% %TEMP_PS1%
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
    "try { Invoke-WebRequest -Uri '%SCRIPT_URL%' -OutFile '%TEMP_PS1%' -UseBasicParsing -ErrorAction Stop; if ((Get-Item '%TEMP_PS1%').Length -lt 100) { throw 'Downloaded file is too small' } } catch { Write-Host ('  ' + [char]27 + '[91m[FAIL]' + [char]27 + '[0m Download failed: ' + $_.Exception.Message); exit 1 }"
if %ERRORLEVEL% neq 0 (
    echo.
    echo   %C_RED%[FAIL]%C_RESET% Could not download installer.
    echo   %C_DIM%Check your internet connection and that%C_RESET%
    echo   %C_DIM%https://griphook.dev/install.ps1 is reachable.%C_RESET%
    echo.
    if "%NO_PAUSE%"=="0" pause
    exit /b 1
)
echo   %C_GREEN%[ OK ]%C_RESET% Downloaded successfully
echo.

REM ---- 5. Run it ------------------------------------------------------------
call :printStep 4 "Launching installer"
echo   %C_DIM%Note: the installer will print its own UI in this window.%C_RESET%
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%TEMP_PS1%" %FORWARD_ARGS%
set "RC=%ERRORLEVEL%"

REM ---- 6. Cleanup -----------------------------------------------------------
del /f /q "%TEMP_PS1%" >nul 2>&1

echo.
if %RC% neq 0 (
    echo   %C_RED%[FAIL]%C_RESET% Installation failed with exit code %C_BOLD%%RC%%C_RESET%.
    echo   %C_DIM%See messages above for details.%C_RESET%
    if "%NO_PAUSE%"=="0" pause
    exit /b %RC%
)

echo   %C_GREEN%[ OK ]%C_RESET% Installation finished successfully
echo.
echo   %C_BOLD%Next steps:%C_RESET%
echo   %C_DIM%- Dashboard:%C_RESET% http://localhost:3000
echo   %C_DIM%- Agent API:%C_RESET%  http://localhost:8090/health
echo   %C_DIM%- Manage services: %C_RESET%Get-Service Griphook, GriphookUI
echo.
echo   %C_DIM%Need help? https://griphook.dev/docs%C_RESET%
echo.

if "%NO_PAUSE%"=="0" pause
endlocal
exit /b 0

REM ============================================================================
REM   Help screen
REM ============================================================================
:showHelp
echo.
echo   %C_BOLD%GRIPHOOK Windows Installer%C_RESET%
echo.
echo   %C_DIM%Usage:%C_RESET%
echo     install.bat ^<options^>
echo.
echo   %C_DIM%Options:%C_RESET%
echo     %C_CYAN%(no options)%C_RESET%      Interactive install with sensible defaults
echo     %C_CYAN%-SkipUI%C_RESET%          Agent-only: don't install the Control Center UI
echo     %C_CYAN%-SkipServices%C_RESET%    Don't register Windows services
echo     %C_CYAN%-InstallDir DIR%C_RESET%  Custom install location (e.g. C:\Griphook)
echo     %C_CYAN%-NoPause%C_RESET%         Don't pause for keypress (for automation / CI)
echo     %C_CYAN%-Help%C_RESET%             Show this help and exit
echo.
echo   %C_DIM%Examples:%C_RESET%
echo     install.bat
echo     install.bat -SkipUI
echo     install.bat -InstallDir "D:\Tools\Griphook" -NoPause
echo.
echo   %C_DIM%Notes:%C_RESET%
echo     - Must be run as %C_BOLD%Administrator%C_RESET% (the .bat will detect and prompt you)
echo     - Downloads install.ps1 from %C_DIM%https://griphook.dev/install.ps1%C_RESET%
echo     - All install logic lives in install.ps1; this .bat is just a launcher
echo.
endlocal
exit /b 0
