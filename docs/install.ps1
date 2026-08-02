# Wrapper script - downloads the latest Windows installer from GitHub and runs it.
# The installer uses [CmdletBinding()] param(...) at the top, so it CANNOT be
# loaded via Invoke-Expression (attributes/param are only valid at script top
# level). We download it to a temp file and invoke it with -File, which also
# lets us forward args.
#
# Usage (elevated PowerShell):
#   irm https://griphook.dev/install.ps1 | iex
#
# Usage with args (elevated PowerShell):
#   & { irm https://griphook.dev/install.psA1 | iex } -SkipUI
#
# Via install.bat (forwards args here too):
#   install.bat -SkipUI

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'

# Append a cache-buster query param so raw.githubusercontent.com's CDN
# doesn't serve a stale cached copy of install.ps1 (5min TTL). The param
# is ignored by GitHub but defeats intermediate caches.
$src = "https://raw.githubusercontent.com/nullruntime-dev/runner-agent/main/install.ps1?v=$((Get-Date).ToString('yyyyMMddHHmmss'))"
$tmp = Join-Path $env:TEMP ('griphook-install-' + [Guid]::NewGuid().ToString('N') + '.ps1')

try {
    Invoke-WebRequest -Uri $src -OutFile $tmp -UseBasicParsing
    # Unblock any Zone.Identifier mark (Mark-of-the-Web) so execution policy
    # doesn't reject the downloaded file.
    Unblock-File -Path $tmp -ErrorAction SilentlyContinue
    # Run in a child process with -ExecutionPolicy Bypass so the signed-script
    # policy can't block it. Forward all args.
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $tmp @args
    $exit = $LASTEXITCODE
} finally {
    Remove-Item -Force -ErrorAction SilentlyContinue $tmp
}

exit $exit
