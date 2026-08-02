@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1

REM ============================================================================
REM  test-installer.bat
REM  Local validation of the Windows installer chain. No network install.
REM
REM  Checks:
REM    1. install.bat -Help              (banner + step printer + arg parse)
REM    2. docs/install.ps1 regression    (no executable iex, uses -File $tmp @args)
REM
REM  Run from repo root:
REM    test\test-installer.bat
REM ============================================================================

set "ESC="
for /F "usebackq tokens=* " %%i in (`powershell -NoProfile -Command "Write-Host -NoNewline ([char]27)"`) do set "ESC=%%i"
set "C_RESET=%ESC%[0m"
set "C_BOLD=%ESC%[1m"
set "C_GREEN=%ESC%[92m"
set "C_RED=%ESC%[91m"
set "C_CYAN=%ESC%[96m"
set "C_DIM=%ESC%[2m"

set "REPO=%~dp0.."
pushd "%REPO%" >nul

set "PASS=0"
set "FAIL=0"

echo.
echo   %C_CYAN%GRIPHOOK installer local test%C_RESET%
echo   %C_DIM%Repo: %CD%%C_RESET%
echo.

REM ---- Test 1: install.bat -Help -------------------------------------------
echo   %C_DIM%[1/2]%C_RESET% %C_BOLD%install.bat -Help%C_RESET%
set "OUT="
REM Capture output to a temp file so we can inspect it.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "& cmd.exe /c '%REPO%\install.bat -Help' 2>&1" > "%TEMP%\griphook-help.txt"
set "RC=%ERRORLEVEL%"
findstr /C:"GRIPHOOK Windows Installer" "%TEMP%\griphook-help.txt" >nul
if !ERRORLEVEL! equ 0 (
    findstr /C:"-SkipUI" "%TEMP%\griphook-help.txt" >nul
    if !ERRORLEVEL! equ 0 (
        echo     %C_GREEN%PASS%C_RESET% Help screen rendered with options list
        set /a PASS+=1
    ) else (
        echo     %C_RED%FAIL%C_RESET% Help missing options list (arg parse broken)
        set /a FAIL+=1
    )
) else (
    echo     %C_RED%FAIL%C_RESET% Banner not printed - install.bat fell through early
    echo     %C_DIM%First 5 lines:%C_RESET%
    powershell -NoProfile -Command "Get-Content '%TEMP%\griphook-help.txt' -TotalCount 5 | ForEach-Object { '      ' + $_ }"
    set /a FAIL+=1
)
del /f /q "%TEMP%\griphook-help.txt" >nul 2>&1

REM ---- Test 2: docs/install.ps1 regression (no iex, uses -File) -------------
echo   %C_DIM%[2/2]%C_RESET% %C_BOLD%docs/install.ps1 wrapper regression%C_RESET%
REM Old bug: wrapper used Invoke-Expression (iex) which cannot run a
REM [CmdletBinding()] param() script. Fix: powershell -File $tmp @args.
REM Note: "Invoke-Expression" appears in a comment, so use a comment-aware
REM powershell check instead of naive findstr.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$w = Get-Content '%REPO%\docs\install.ps1'; $iex = ($w | Where-Object { $_ -notmatch '^\s*#' -and $_ -match 'Invoke-Expression' }).Count; $fileTmp = ($w | Where-Object { $_ -match '-File \$tmp' }).Count; $argC = ($w | Where-Object { $_ -match '@args' }).Count; if ($iex -eq 0 -and $fileTmp -ge 1 -and $argC -ge 1) { 'PASS' } else { 'FAIL iex=' + $iex + ' fileTmp=' + $fileTmp + ' args=' + $argC }" > "%TEMP%\griphook-wrap-check.txt" 2>&1
findstr /C:"PASS" "%TEMP%\griphook-wrap-check.txt" >nul
if !ERRORLEVEL! equ 0 (
    echo     %C_GREEN%PASS%C_RESET% Wrapper uses -File $tmp @args, no executable iex
    set /a PASS+=1
) else (
    echo     %C_RED%FAIL%C_RESET% Wrapper regression:
    type "%TEMP%\griphook-wrap-check.txt"
    set /a FAIL+=1
)
del /f /q "%TEMP%\griphook-wrap-check.txt" >nul 2>&1

REM ---- Summary --------------------------------------------------------------
echo.
if %FAIL% equ 0 (
    echo   %C_GREEN%ALL PASS%C_RESET%  %PASS%/2
) else (
    echo   %C_RED%%FAIL% FAILED%C_RESET%  %PASS%/2 passed
)
echo.
popd
endlocal
exit /b %FAIL%