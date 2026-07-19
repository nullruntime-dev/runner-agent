@echo off
setlocal

REM ============================================================================
REM GRIPHOOK Windows Installer (wrapper)
REM
REM Downloads install.ps1 from the official source and runs it in an elevated
REM PowerShell session. This wrapper exists because:
REM   1. Double-clicking a .ps1 doesn't request UAC elevation by default
REM   2. PowerShell execution policy often blocks .ps1 files downloaded from
REM      the internet (the "not digitally signed" error)
REM   3. Batch files bypass both of the above
REM
REM Usage:
REM   install.bat                     -- install with defaults
REM   install.bat -SkipServices       -- install but don't register services
REM   install.bat -SkipUI             -- install agent only (no frontend UI).
REM                                       Use when you already have a UI
REM                                       instance and just want to add
REM                                       another agent to it.
REM   install.bat -InstallDir C:\Foo  -- custom install location
REM
REM Any extra args are forwarded to install.ps1.
REM ============================================================================

set "SCRIPT_URL=https://griphook.dev/install.ps1"
set "TEMP_PS1=%TEMP%\griphook-install-%RANDOM%.ps1"

echo.
echo  +-------------------------------------------+
echo  |       GRIPHOOK WINDOWS INSTALLER          |
echo  |    AI-Powered Deployment Agent [Win]     |
echo  +-------------------------------------------+
echo.

REM -- 1. Check for admin (UAC) -----------------------------------------------
net session >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [FAIL] This installer must be run as Administrator.
    echo.
    echo   Right-click install.bat and choose "Run as administrator".
    echo.
    pause
    exit /b 1
)
echo [ OK ] Running as Administrator

REM -- 2. Download install.ps1 -------------------------------------------------
echo [INFO] Downloading installer from %SCRIPT_URL% ...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
    "try { Invoke-WebRequest -Uri '%SCRIPT_URL%' -OutFile '%TEMP_PS1%' -UseBasicParsing -ErrorAction Stop } catch { Write-Host '[FAIL] Download failed:' $_.Exception.Message; exit 1 }"
if %ERRORLEVEL% neq 0 (
    echo [FAIL] Could not download installer.
    pause
    exit /b 1
)
echo [ OK ] Downloaded %TEMP_PS1%

REM -- 3. Run it (Bypass policy; no profile; forward all args) -----------------
echo [INFO] Launching installer...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%TEMP_PS1%" %*
set "RC=%ERRORLEVEL%"

REM -- 4. Cleanup -------------------------------------------------------------
del /f /q "%TEMP_PS1%" >nul 2>&1

if %RC% neq 0 (
    echo.
    echo [FAIL] Installation failed (exit %RC%). See messages above.
    pause
    exit /b %RC%
)

echo.
echo [ OK ] Installer finished.
pause
endlocal
