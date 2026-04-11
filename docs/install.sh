#!/usr/bin/env bash
# Wrapper script - fetches and executes the latest installer from GitHub
exec curl -fsSL https://raw.githubusercontent.com/nullruntime-dev/runner-agent/main/install.sh | bash -s -- "$@"