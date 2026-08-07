#!/usr/bin/env bash
#
# GRIPHOOK Docker-only installer
# - Checks for Docker (any OS)
# - Windows: prints Docker Desktop install instructions (no auto-install)
# - Linux: installs Docker + compose via the system package manager
# - Downloads docker-compose.prod.yml from GitHub, writes .env, starts containers
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/nullruntime-dev/runner-agent/main/install-docker.sh | bash
#   ./install-docker.sh [OPTIONS]
#
# Options:
#   --agent-only      Only start the backend agent container (skip UI)
#   --port PORT       Server port (default 8090, auto-bumped if in use)
#   --install-dir DIR Install directory (default /opt/griphook; C:\griphook on Windows)
#   --help, -h        Show this help

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

GITHUB_REPO="nullruntime-dev/runner-agent"
INSTALL_DIR="${INSTALL_DIR:-/opt/griphook}"
AGENT_ONLY=0
# Compose hardcodes host ports: agent 8090, UI 3000. SERVER_PORT in .env is
# NOT wired through docker-compose.prod.yml (it sets SERVER_PORT=8090 inline),
# so we don't prompt for it here.
AGENT_HOST_PORT=8090
UI_HOST_PORT=3000

log_info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

print_banner() {
    echo -e "${CYAN}"
    echo "  ╔═══════════════════════════════════════════╗"
    echo "  ║      GRIPHOOK DOCKER INSTALLER            ║"
    echo "  ║       AI-Powered Deployment Agent         ║"
    echo "  ╚═══════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Detect OS + package manager
detect_os() {
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OS" == "Windows_NT" ]]; then
        OS="windows"
        PKG_MANAGER="unknown"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        PKG_MANAGER="brew"
    elif [ -f /etc/os-release ]; then
        . /etc/os-release
        case "$ID" in
            ubuntu|debian|pop|linuxmint) OS="debian";   PKG_MANAGER="apt" ;;
            fedora)                       OS="fedora";   PKG_MANAGER="dnf" ;;
            centos|rhel|rocky|almalinux)  OS="rhel";     PKG_MANAGER="dnf" ;;
            arch|manjaro|endeavouros)     OS="arch";     PKG_MANAGER="pacman" ;;
            opensuse*|sles)               OS="suse";     PKG_MANAGER="zypper" ;;
            *)                            OS="unknown";  PKG_MANAGER="unknown" ;;
        esac
    else
        OS="unknown"
        PKG_MANAGER="unknown"
    fi
    log_info "Detected OS: $OS (package manager: $PKG_MANAGER)"
}

check_privileges() {
    if [ "$OS" == "windows" ] || [ "$OS" == "macos" ]; then
        SUDO=""
        return 0
    fi
    if [ "$EUID" -eq 0 ]; then
        SUDO=""
    elif command -v sudo &> /dev/null; then
        SUDO="sudo"
        log_info "Using sudo for privileged operations"
    else
        log_error "Root or sudo required"
        exit 1
    fi
}

# Is docker present and the daemon reachable?
check_docker() {
    if ! command -v docker &> /dev/null; then
        return 1
    fi
    if docker info &> /dev/null; then
        return 0
    fi
    # docker exists but daemon not reachable
    log_warn "Docker is installed but the daemon is not reachable"
    return 2
}

# Windows: cannot auto-install Docker. Show instructions and stop.
show_windows_docker_instructions() {
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}Docker is required on Windows${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  Option A — winget (PowerShell as Admin):"
    echo -e "    ${CYAN}winget install -e --id Docker.DockerDesktop${NC}"
    echo ""
    echo -e "  Option B — download the installer:"
    echo -e "    ${CYAN}https://www.docker.com/products/docker-desktop/${NC}"
    echo ""
    echo -e "  After install:"
    echo -e "    1. Start Docker Desktop (wait for the whale icon in the tray)"
    echo -e "    2. Re-run this script in Git Bash:"
    echo -e "       ${CYAN}./install-docker.sh${NC}"
    echo ""
    exit 1
}

# Linux: install docker + compose plugin via the system package manager.
install_docker_linux() {
    log_info "Installing Docker via $PKG_MANAGER..."
    case "$PKG_MANAGER" in
        apt)
            $SUDO apt-get update -qq
            $SUDO apt-get install -y ca-certificates curl gnupg
            $SUDO install -m 0755 -d /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/ubuntu/gpg | $SUDO gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null || true
            $SUDO chmod a+r /etc/apt/keyrings/docker.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
                | $SUDO tee /etc/apt/sources.list.d/docker.list > /dev/null
            $SUDO apt-get update -qq
            $SUDO apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
        dnf)
            $SUDO dnf -y install dnf-plugins-core
            $SUDO dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
            $SUDO dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
        pacman)
            $SUDO pacman -Sy --noconfirm docker docker-compose
            ;;
        zypper)
            $SUDO zypper install -y docker docker-compose
            ;;
        *)
            log_error "Unsupported package manager: $PKG_MANAGER"
            log_info "Install Docker manually: https://docs.docker.com/get-docker/"
            exit 1
            ;;
    esac

    $SUDO systemctl start docker
    $SUDO systemctl enable docker
    $SUDO usermod -aG docker "$USER" 2>/dev/null || true
    log_success "Docker installed"
}

# macOS: brew cask docker (user starts it manually).
install_docker_macos() {
    if ! command -v brew &> /dev/null; then
        log_error "Homebrew not found. Install Docker Desktop from https://www.docker.com/products/docker-desktop/"
        exit 1
    fi
    brew install --cask docker
    log_warn "Start Docker Desktop manually, then re-run this script."
    exit 0
}

ensure_docker() {
    local rc
    check_docker; rc=$?
    if [ "$rc" -eq 0 ]; then
        log_success "Docker is installed and running"
        return 0
    fi
    if [ "$rc" -eq 2 ]; then
        # daemon down — try to start it on Linux
        if [ "$OS" != "windows" ] && [ "$OS" != "macos" ]; then
            log_info "Starting docker daemon..."
            $SUDO systemctl start docker || true
            sleep 2
            if docker info &> /dev/null; then
                log_success "Docker daemon started"
                return 0
            fi
        fi
        log_error "Docker daemon not reachable. Start it, then re-run."
        exit 1
    fi
    # docker not installed
    case "$OS" in
        windows) show_windows_docker_instructions ;;
        macos)   install_docker_macos ;;
        *)       install_docker_linux ;;
    esac
    # re-check after install
    if ! check_docker; then
        log_error "Docker install did not succeed. Install manually and re-run."
        exit 1
    fi
}

# Interactive: prompt for API key + token + port, write .env
configure_env_interactive() {
    local env_file="$1"

    echo ""
    echo -e "${CYAN}════════════════════════════════════════════${NC}"
    echo -e "${CYAN}         Quick Configuration                ${NC}"
    echo -e "${CYAN}════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${BOLD}Configure essential settings now?${NC} ${DIM}(you can edit ${env_file} later)${NC}"
    echo -n "Configure now? [Y/n]: "
    read -r configure_choice < /dev/tty
    if [[ "$configure_choice" =~ ^[Nn]$ ]]; then
        log_info "Skipping configuration. Edit ${env_file} manually."
        return
    fi

    echo ""
    echo -e "  Get a Google AI API key: ${CYAN}https://aistudio.google.com/apikey${NC}"
    echo -n "  Enter your Google AI API Key (optional): "
    read -r google_api_key < /dev/tty

    echo ""
    echo -e "  ${DIM}Press Enter to auto-generate the agent token, or enter your own.${NC}"
    echo -n "  Enter Agent Token [auto-generate]: "
    read -r agent_token < /dev/tty
    if [ -z "$agent_token" ]; then
        if command -v openssl &> /dev/null; then
            agent_token=$(openssl rand -hex 32)
        else
            agent_token=$(head -c 32 /dev/urandom | xxd -p | tr -d '\n')
        fi
        echo -e "  ${GREEN}Generated:${NC} ${agent_token:0:16}..."
    fi

    update_env_var() {
        local key="$1" value="$2" file="$3"
        if grep -q "^${key}=" "$file" 2>/dev/null; then
            $SUDO sed -i "s|^${key}=.*|${key}=${value}|" "$file"
        else
            echo "${key}=${value}" | $SUDO tee -a "$file" > /dev/null
        fi
    }
    [ -n "$google_api_key" ] && update_env_var "GOOGLE_AI_API_KEY" "$google_api_key" "$env_file"
    [ -n "$agent_token" ]    && update_env_var "AGENT_TOKEN" "$agent_token" "$env_file"

    echo ""
    log_success "Configuration saved to ${env_file}"
    echo -e "  ${CYAN}API Key:${NC}  ${google_api_key:+configured}${google_api_key:-not set}"
    echo -e "  ${CYAN}Token:${NC}    ${agent_token:0:16}..."
    echo -e "  ${CYAN}Agent port:${NC} ${AGENT_HOST_PORT} (host)  ${CYAN}UI port:${NC} ${UI_HOST_PORT} (host)"
    echo ""
}

print_next_steps() {
    local env_file="$1"
    echo -e "${GREEN}════════════════════════════════════════════${NC}"
    echo -e "${GREEN}         Installation Complete!             ${NC}"
    echo -e "${GREEN}════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${CYAN}1.${NC} Containers are running. Edit config and restart to apply:"
    echo -e "     ${YELLOW}sudo nano ${env_file}${NC}"
    echo -e "     ${YELLOW}cd ${INSTALL_DIR} && sudo docker compose -f docker-compose.yml up -d${NC}"
    echo ""
    echo -e "  ${CYAN}2.${NC} Check status:"
    echo -e "     ${YELLOW}cd ${INSTALL_DIR} && sudo docker compose -f docker-compose.yml ps${NC}"
    echo ""
    echo -e "  ${CYAN}3.${NC} View logs:"
    echo -e "     ${YELLOW}sudo docker compose -f docker-compose.yml logs -f${NC}"
    echo ""
    if [ "$AGENT_ONLY" -eq 1 ]; then
        echo -e "  ${CYAN}4.${NC} API + health:"
        echo -e "     ${YELLOW}http://localhost:${AGENT_HOST_PORT}${NC}  (API)"
        echo -e "     ${YELLOW}http://localhost:${AGENT_HOST_PORT}/health${NC}"
    else
        echo -e "  ${CYAN}4.${NC} Access the dashboard:"
        echo -e "     ${YELLOW}http://localhost:${UI_HOST_PORT}${NC}  (UI)"
        echo -e "     ${YELLOW}http://localhost:${AGENT_HOST_PORT}${NC}  (API)"
    fi
    echo ""
    echo -e "  ${CYAN}Docs:${NC} https://github.com/${GITHUB_REPO}"
    echo ""

    local saved_token
    saved_token=$(grep -E '^AGENT_TOKEN=' "$env_file" 2>/dev/null | cut -d'=' -f2-)
    if [ -n "$saved_token" ]; then
        echo -e "${GREEN}════════════════════════════════════════════${NC}"
        echo -e "${GREEN}             Your Agent Token               ${NC}"
        echo -e "${GREEN}════════════════════════════════════════════${NC}"
        echo ""
        echo -e "  ${CYAN}AGENT_TOKEN:${NC} ${YELLOW}${saved_token}${NC}"
        echo ""
        echo -e "  ${DIM}Save this token. Use it for API auth and connecting CLI/UI.${NC}"
        echo ""
        echo -e "  ${YELLOW}curl http://localhost:${AGENT_HOST_PORT}/health${NC}"
        echo -e "    ${YELLOW}-H \"Authorization: Bearer ${saved_token}\"${NC}"
        echo ""
    fi
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --agent-only) AGENT_ONLY=1; shift ;;
            --install-dir) INSTALL_DIR="$2"; shift 2 ;;
            --help|-h)
                echo "GRIPHOOK Docker installer"
                echo ""
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --agent-only      Only start the backend agent (no UI)"
                echo "  --install-dir DIR Install directory (default /opt/griphook; C:\\griphook on Windows)"
                echo "  --help            Show this help"
                echo ""
                echo "Host ports are fixed by docker-compose.prod.yml:"
                echo "  agent ${AGENT_HOST_PORT}  ui ${UI_HOST_PORT}"
                exit 0
                ;;
            *) log_error "Unknown option: $1"; echo "Use --help"; exit 1 ;;
        esac
    done
}

main() {
    parse_args "$@"

    print_banner
    detect_os
    check_privileges

    ensure_docker

    # Install dir
    if [ "$OS" == "windows" ]; then
        INSTALL_DIR="${INSTALL_DIR:-/c/griphook}"
        mkdir -p "$INSTALL_DIR"
    else
        INSTALL_DIR="${INSTALL_DIR:-/opt/griphook}"
        $SUDO mkdir -p "$INSTALL_DIR"
    fi
    cd "$INSTALL_DIR"

    # Download the prod compose file. The backend uses embedded SQLite
    # (no DB server); docker-compose.prod.yml defines its own bridge
    # network, so no separate compose file is needed.
    local base="https://raw.githubusercontent.com/${GITHUB_REPO}/main"
    log_info "Downloading docker-compose.prod.yml..."
    if [ "$OS" == "windows" ]; then
        curl -fsSL -o docker-compose.yml "${base}/docker-compose.prod.yml"
    else
        $SUDO curl -fsSL -o docker-compose.yml "${base}/docker-compose.prod.yml"
    fi
    # Fix the known typo in the prod compose file if present
    $SUDO sed -i 's/\${AG aaENT_MAX_CONCURRENT:-5}/${AGENT_MAX_CONCURRENT:-5}/g' docker-compose.yml 2>/dev/null || \
      sed -i 's/\${AG aaENT_MAX_CONCURRENT:-5}/${AGENT_MAX_CONCURRENT:-5}/g' docker-compose.yml 2>/dev/null || true

    # Create .env if missing. Compose sets SERVER_PORT=8090 inline; host ports
    # are fixed by docker-compose.prod.yml: agent ${AGENT_HOST_PORT}, UI ${UI_HOST_PORT}.
    local env_file="${INSTALL_DIR}/.env"
    if [ ! -f "$env_file" ]; then
        if [ "$OS" == "windows" ]; then
            cat > "$env_file" << EOF
# GRIPHOOK Configuration
# Host ports (set by docker-compose.prod.yml): agent ${AGENT_HOST_PORT}, UI ${UI_HOST_PORT}
AGENT_TOKEN=change-me-to-secure-token
GOOGLE_AI_API_KEY=
AGENT_ADK_MODEL=gemini-2.0-flash
AGENT_ADK_ENABLED=true
EOF
        else
            $SUDO tee "$env_file" > /dev/null << EOF
# GRIPHOOK Configuration
# Host ports (set by docker-compose.prod.yml): agent ${AGENT_HOST_PORT}, UI ${UI_HOST_PORT}
AGENT_TOKEN=change-me-to-secure-token
GOOGLE_AI_API_KEY=
AGENT_ADK_MODEL=gemini-2.0-flash
AGENT_ADK_ENABLED=true
EOF
        fi
        log_success "Created ${env_file}"
    fi

    # Interactive configuration
    configure_env_interactive "$env_file"

    # Pull images
    log_info "Pulling Docker images..."
    if [ "$OS" == "windows" ]; then
        docker compose -f docker-compose.yml pull
    else
        $SUDO docker compose -f docker-compose.yml pull
    fi

    # Start agent (+ ui unless --agent-only). Prod compose service name: agent.
    log_info "Starting agent..."
    local up_cmd
    if [ "$AGENT_ONLY" -eq 1 ]; then
        up_cmd="docker compose -f docker-compose.yml up -d agent"
    else
        up_cmd="docker compose -f docker-compose.yml up -d"
    fi
    if [ "$OS" == "windows" ]; then
        if $up_cmd; then
            log_success "Containers started"
        else
            log_warn "agent up -d failed; run manually: cd ${INSTALL_DIR} && docker compose -f docker-compose.yml up -d"
        fi
    else
        if $SUDO $up_cmd; then
            log_success "Containers started"
        else
            log_warn "agent up -d failed; run manually: cd ${INSTALL_DIR} && sudo docker compose -f docker-compose.yml up -d"
        fi
    fi

    print_next_steps "$env_file"
}

main "$@"