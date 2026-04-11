# Wrapper script - fetches and executes the latest Windows installer from GitHub
# Usage (elevated PowerShell): irm https://griphook.dev/install.ps1 | iex
$ErrorActionPreference = 'Stop'
Invoke-Expression (Invoke-RestMethod -Uri 'https://raw.githubusercontent.com/nullruntime-dev/runner-agent/main/install.ps1' -UseBasicParsing)
