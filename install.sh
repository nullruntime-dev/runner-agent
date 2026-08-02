#!/usr/bin/env bash
#
# GRIPHOOK Installer
# Interactive installer with multiple installation methods
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# Configuration
GRIPHOOK_VERSION="${GRIPHOOK_VERSION:-0.1.0-SNAPSHOT}"
INSTALL_DIR="${INSTALL_DIR:-/opt/griphook}"
GITHUB_REPO="nullruntime-dev/runner-agent"
JAR_NAME="runner-agent-${GRIPHOOK_VERSION}.jar"
DOCKER_IMAGE_AGENT="nullruntimedev/griphook-agent:latest"
DOCKER_IMAGE_UI="nullruntimedev/griphook-ui:latest"

# cli-executor (standalone command-runner microservice)
CLI_EXECUTOR_PORT="${CLI_EXECUTOR_PORT:-8010}"
CLI_EXECUTOR_TOKEN="${CLI_EXECUTOR_TOKEN:-}"
# Defaults per OS (set in install_cli_executor_method): /opt/cli-executor on Linux, /c/cli-executor on Windows

# Required versions
REQUIRED_JAVA_VERSION=21
REQUIRED_NODE_VERSION=22

# Installation method (set by menu or CLI arg)
INSTALL_METHOD=""

# Agent-only mode: install just the backend, no UI. Set by --agent-only.
# Use this when you already have a GRIPHOOK UI instance and want to add
# another agent to it (one UI can manage many agents).
AGENT_ONLY=0

print_banner() {
    echo -e "${CYAN}"
    echo "  ╔═══════════════════════════════════════════╗"
    echo "  ║           GRIPHOOK INSTALLER              ║"
    echo "  ║       AI-Powered Deployment Agent         ║"
    echo "  ╚═══════════════════════════════════════════╝"
    echo -e "${NC}"
}


log_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Show installation method menu
show_menu() {
    echo ""
    echo -e "${BOLD}Select installation method:${NC}"
    echo ""
    echo -e "  ${GREEN}1)${NC} ${BOLD}Docker Compose${NC} ${GREEN}(Recommended)${NC}"
    echo -e "     ${DIM}Fastest setup. Runs agent + UI in containers.${NC}"
    echo ""
    echo -e "  ${CYAN}2)${NC} ${BOLD}Standalone JAR${NC}"
    echo -e "     ${DIM}Download JAR and run with Java 21. Uses svcify for service management.${NC}"
    echo ""
    echo -e "  ${MAGENTA}3)${NC} ${BOLD}Build from Source${NC}"
    echo -e "     ${DIM}Clone repo and build with Gradle. Uses svcify for service management.${NC}"
    echo ""
    echo -e "  ${YELLOW}4)${NC} ${BOLD}Ubuntu Sandbox${NC}"
    echo -e "     ${DIM}Run in isolated Ubuntu container with systemd. Great for testing.${NC}"
    echo ""
    echo -e "  ${BLUE}5)${NC} ${BOLD}CLI Executor${NC}"
    echo -e "     ${DIM}Standalone command-runner microservice. Deploys on remote servers the agent reaches over HTTP. svcify on Linux, nssm.exe on Windows.${NC}"
    echo ""
    echo -e "  ${RED}q)${NC} ${BOLD}Quit${NC}"
    echo ""

    while true; do
        echo -n "Enter choice [1-5, q]: "
        read choice < /dev/tty
        case "$choice" in
            1) INSTALL_METHOD="docker"; break ;;
            2) INSTALL_METHOD="jar"; break ;;
            3) INSTALL_METHOD="source"; break ;;
            4) INSTALL_METHOD="sandbox"; break ;;
            5) INSTALL_METHOD="cli-executor"; break ;;
            q|Q) echo "Cancelled."; exit 0 ;;
            *) echo -e "${RED}Invalid choice. Please enter 1, 2, 3, 4, 5, or q.${NC}" ;;
        esac
    done
}

# Detect OS and package manager
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
            ubuntu|debian|pop|linuxmint)
                OS="debian"
                PKG_MANAGER="apt"
                ;;
            fedora)
                OS="fedora"
                PKG_MANAGER="dnf"
                ;;
            centos|rhel|rocky|almalinux)
                OS="rhel"
                PKG_MANAGER="dnf"
                ;;
            arch|manjaro|endeavouros)
                OS="arch"
                PKG_MANAGER="pacman"
                ;;
            opensuse*|sles)
                OS="suse"
                PKG_MANAGER="zypper"
                ;;
            *)
                OS="unknown"
                PKG_MANAGER="unknown"
                ;;
        esac
    else
        OS="unknown"
        PKG_MANAGER="unknown"
    fi

    log_info "Detected OS: $OS (package manager: $PKG_MANAGER)"
}

# Check if running as root or can use sudo
check_privileges() {
    if [ "$OS" == "windows" ]; then
        SUDO=""
        log_info "Windows detected; run this script as Administrator for service creation"
        return 0
    fi
    if [ "$EUID" -eq 0 ]; then
        SUDO=""
    elif command -v sudo &> /dev/null; then
        SUDO="sudo"
        log_info "Using sudo for privileged operations"
    else
        log_error "This script requires root privileges or sudo"
        exit 1
    fi
}

# Check if Docker is installed
check_docker() {
    if command -v docker &> /dev/null; then
        if docker info &> /dev/null; then
            log_success "Docker is installed and running"
            return 0
        else
            log_warn "Docker is installed but not running or requires sudo"
            return 1
        fi
    else
        return 1
    fi
}

# Install Docker
install_docker() {
    log_info "Installing Docker..."

    case "$PKG_MANAGER" in
        apt)
            $SUDO apt-get update -qq
            $SUDO apt-get install -y ca-certificates curl gnupg
            $SUDO install -m 0755 -d /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/ubuntu/gpg | $SUDO gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null || true
            $SUDO chmod a+r /etc/apt/keyrings/docker.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | $SUDO tee /etc/apt/sources.list.d/docker.list > /dev/null
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
        brew)
            brew install --cask docker
            log_warn "Please start Docker Desktop manually"
            ;;
        *)
            log_error "Please install Docker manually: https://docs.docker.com/get-docker/"
            exit 1
            ;;
    esac

    # Start and enable Docker
    if [ "$OS" != "macos" ]; then
        $SUDO systemctl start docker
        $SUDO systemctl enable docker
        # Add current user to docker group
        $SUDO usermod -aG docker "$USER" 2>/dev/null || true
    fi

    log_success "Docker installed"
}

# Install via Ubuntu Sandbox (Docker container with systemd)
install_sandbox_method() {
    log_info "Setting up GRIPHOOK in Ubuntu Sandbox..."

    # Check/install Docker
    if ! check_docker; then
        install_docker
    fi

    SANDBOX_IMAGE="nullruntimedev/ubuntu-systemd-sandbox:latest"
    CONTAINER_NAME="griphook-sandbox"

    # Pull the sandbox image
    log_info "Pulling Ubuntu Sandbox image..."
    docker pull "$SANDBOX_IMAGE"

    # Stop and remove existing container if exists
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        log_info "Removing existing sandbox container..."
        docker stop "$CONTAINER_NAME" 2>/dev/null || true
        docker rm "$CONTAINER_NAME" 2>/dev/null || true
    fi

    # Run the sandbox container
    log_info "Starting Ubuntu Sandbox container..."
    docker run -d \
        --name "$CONTAINER_NAME" \
        --privileged \
        -p 3000:3000 \
        -p 8090:8090 \
        -v /sys/fs/cgroup:/sys/fs/cgroup:rw \
        --cgroupns=host \
        "$SANDBOX_IMAGE"

    # Wait for container to be ready
    log_info "Waiting for container to start..."
    sleep 3

    # Check if container is running
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        log_success "Ubuntu Sandbox container is running"
    else
        log_error "Failed to start sandbox container"
        docker logs "$CONTAINER_NAME"
        exit 1
    fi

    log_success "Ubuntu Sandbox installation complete"
}

# Install via Docker Compose
install_docker_method() {
    log_info "Installing GRIPHOOK via Docker Compose..."

    # Check/install Docker
    if ! check_docker; then
        install_docker
    fi

    # Create install directory
    $SUDO mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"

    # Download docker-compose.prod.yml
    log_info "Downloading Docker Compose configuration..."
    $SUDO curl -fsSL -o docker-compose.yml \
        "https://raw.githubusercontent.com/${GITHUB_REPO}/main/docker-compose.prod.yml"

    # Fix known typo in downloaded compose file (${\AG aaENT_MAX_CONCURRENT...})
    $SUDO sed -i 's/\${AG aaENT_MAX_CONCURRENT:-5}/${AGENT_MAX_CONCURRENT:-5}/g' docker-compose.yml 2>/dev/null || true

    # Create .env.bak file
    if [ ! -f ".env" ]; then
        log_info "Creating default configuration..."

        # Pick a free port for the default (8090, bumped by +100 if in use).
        local default_port
        default_port=$(find_free_port 8090)
        if [ "$default_port" != "8090" ]; then
            log_warn "Default port 8090 is in use, using ${default_port} instead."
        fi

        $SUDO tee .env.bak > /dev/null << EOF
# GRIPHOOK Configuration
# Generate a secure token: openssl rand -hex 32
AGENT_TOKEN=change-me-to-secure-token

# Google AI API Key (required for AI chat)
# Get one at: https://aistudio.google.com/apikey
GOOGLE_AI_API_KEY=

# Server settings
SERVER_PORT=${default_port}

# AI Model
AGENT_ADK_MODEL=gemini-2.0-flash
AGENT_ADK_ENABLED=true
EOF
        log_success "Created ${INSTALL_DIR}/.env"
    fi

    # Pull images
    log_info "Pulling Docker images..."
    $SUDO docker compose pull

    # Interactive configuration
    configure_env_interactive

    # Start the stack so the user doesn't have to. They pulled images + wrote
    # .env; leaving containers stopped defeats "install".
    log_info "Starting GRIPHOOK containers..."
    if $SUDO docker compose up -d; then
        log_success "Containers started"
    else
        log_warn "docker compose up -d failed; run it manually: cd ${INSTALL_DIR} && sudo docker compose up -d"
    fi

    log_success "Docker installation complete"
}

# Find a free port starting from $1, incrementing by 100 if busy (cap at 65535).
# Echos the free port. Falls back to the original if something goes wrong.
find_free_port() {
    local start_port="$1"
    local port="${start_port:-8090}"
    local cap=65535
    local tried=""

    # Pick a port-check command that exists on this OS.
    #   - Linux:  `ss -ltn` (iproute2) preferred, /proc/net/tcp fallback
    #   - macOS:  `lsof -nP -iTCP:` (netstat -an is less reliable for listen sockets)
    #   - Windows (Git Bash / MSYS2): `netstat -an` (no ss, no /proc, lsof may be absent)
    local port_busy
    if [ "$OS" = "macos" ] || ! command -v ss &> /dev/null; then
        if command -v lsof &> /dev/null; then
            port_busy() {
                lsof -nP -iTCP:"$1" -sTCP:LISTEN 2>/dev/null | grep -q .
            }
        else
            # Last-resort fallback: netstat -an (works on macOS, Windows Git Bash, Linux)
            port_busy() {
                netstat -an 2>/dev/null | grep -E "(^|\\.|:)$1\\s" | grep -qi 'LISTEN'
            }
        fi
    else
        port_busy() {
            ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "(^|:)$1$"
        }
    fi

    while [ "$port" -le "$cap" ]; do
        if ! port_busy "$port"; then
            echo "$port"
            return 0
        fi
        tried="${tried:+$tried, }$port"
        port=$((port + 100))
    done

    # Exhausted the range — return the original as a last resort.
    log_warn "Could not find a free port (tried: ${tried:-none}). Using ${start_port}."
    echo "${start_port:-8090}"
}

# Get installed Java major version (handles OpenJDK, Oracle, Temurin, GraalVM, EA builds)
get_java_version() {
    if ! command -v java &> /dev/null; then
        echo "0"
        return
    fi
    local ver
    # Java 9+: --version writes to stdout
    ver=$(java --version 2>/dev/null | head -n1 | grep -oE '[0-9]+' | head -n1)
    # Fallback for Java 8 which only supports -version (to stderr)
    if [ -z "$ver" ]; then
        ver=$(java -version 2>&1 | head -n1 | grep -oE '[0-9]+' | head -n1)
    fi
    echo "${ver:-0}"
}

# Install JDK 21
install_java() {
    log_info "Installing JDK ${REQUIRED_JAVA_VERSION}..."

    case "$PKG_MANAGER" in
        apt)
            $SUDO apt-get update -qq
            $SUDO apt-get install -y openjdk-21-jdk-headless
            ;;
        dnf)
            $SUDO dnf install -y java-21-openjdk-headless
            ;;
        pacman)
            $SUDO pacman -Sy --noconfirm jdk21-openjdk
            ;;
        zypper)
            $SUDO zypper install -y java-21-openjdk-headless
            ;;
        brew)
            brew install openjdk@21
            if [ -d "/opt/homebrew/opt/openjdk@21" ]; then
                $SUDO ln -sfn /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-21.jdk 2>/dev/null || true
            elif [ -d "/usr/local/opt/openjdk@21" ]; then
                $SUDO ln -sfn /usr/local/opt/openjdk@21/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-21.jdk 2>/dev/null || true
            fi
            ;;
        *)
            log_error "Unsupported package manager: $PKG_MANAGER"
            log_info "Please install JDK 21 manually and re-run this script"
            exit 1
            ;;
    esac

    log_success "JDK ${REQUIRED_JAVA_VERSION} installed"
}

# Check Java dependency
check_java() {
    JAVA_VERSION=$(get_java_version)
    # Guard against non-numeric results so [ -ge ] doesn't abort the script under `set -e`.
    if ! [[ "$JAVA_VERSION" =~ ^[0-9]+$ ]]; then
        JAVA_VERSION=0
    fi
    if [ "$JAVA_VERSION" -ge "$REQUIRED_JAVA_VERSION" ]; then
        log_success "Java ${JAVA_VERSION} found (required: ${REQUIRED_JAVA_VERSION}+)"
        return 0
    else
        if [ "$JAVA_VERSION" -eq "0" ]; then
            log_warn "Java not found"
        else
            log_warn "Java ${JAVA_VERSION} found, but ${REQUIRED_JAVA_VERSION}+ required"
        fi
        return 1
    fi
}

# Get installed Node.js version
get_node_version() {
    if command -v node &> /dev/null; then
        node -v 2>/dev/null | sed 's/v//' | cut -d'.' -f1
    else
        echo "0"
    fi
}

# Install Node.js (latest LTS)
install_node() {
    log_info "Installing Node.js ${REQUIRED_NODE_VERSION}..."

    case "$PKG_MANAGER" in
        apt)
            # Install via NodeSource
            curl -fsSL https://deb.nodesource.com/setup_${REQUIRED_NODE_VERSION}.x | $SUDO bash -
            $SUDO apt-get install -y nodejs
            ;;
        dnf)
            curl -fsSL https://rpm.nodesource.com/setup_${REQUIRED_NODE_VERSION}.x | $SUDO bash -
            $SUDO dnf install -y nodejs
            ;;
        pacman)
            $SUDO pacman -Sy --noconfirm nodejs npm
            ;;
        zypper)
            $SUDO zypper install -y nodejs npm
            ;;
        brew)
            brew install node@${REQUIRED_NODE_VERSION}
            ;;
        *)
            log_error "Unsupported package manager: $PKG_MANAGER"
            log_info "Please install Node.js ${REQUIRED_NODE_VERSION}+ manually and re-run this script"
            exit 1
            ;;
    esac

    log_success "Node.js installed: $(node -v)"
}

# Check Node.js dependency
check_node() {
    NODE_VERSION=$(get_node_version)
    if [ "$NODE_VERSION" -ge "$REQUIRED_NODE_VERSION" ]; then
        log_success "Node.js ${NODE_VERSION} found (required: ${REQUIRED_NODE_VERSION}+)"
        return 0
    else
        if [ "$NODE_VERSION" -eq "0" ]; then
            log_warn "Node.js not found"
        else
            log_warn "Node.js ${NODE_VERSION} found, but ${REQUIRED_NODE_VERSION}+ required"
        fi
        return 1
    fi
}

# Install frontend dependencies and create service
install_frontend() {
    log_info "Setting up GRIPHOOK UI (Frontend)..."

    # Check/install Node.js
    if ! check_node; then
        install_node
    fi

    # Check for git
    if ! command -v git &> /dev/null; then
        log_info "Installing git..."
        case "$PKG_MANAGER" in
            apt) $SUDO apt-get install -y git ;;
            dnf) $SUDO dnf install -y git ;;
            pacman) $SUDO pacman -Sy --noconfirm git ;;
            zypper) $SUDO zypper install -y git ;;
            brew) brew install git ;;
        esac
    fi

    # Create UI directory
    UI_DIR="${INSTALL_DIR}/ui"
    $SUDO mkdir -p "$UI_DIR"

    # Download UI source from GitHub
    log_info "Downloading UI source..."
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"

    git clone --depth 1 "https://github.com/${GITHUB_REPO}.git" griphook
    $SUDO cp -r griphook/ui/* "$UI_DIR/"

    # Cleanup
    cd /
    rm -rf "$TEMP_DIR"

    # Install npm dependencies
    log_info "Installing npm dependencies..."
    cd "$UI_DIR"
    $SUDO npm install

    # Create .env.bak.local for UI
    if [ ! -f "${UI_DIR}/.env.local" ]; then
        $SUDO tee "${UI_DIR}/.env.local" > /dev/null << 'EOF'
# GRIPHOOK UI Configuration
# Path to SQLite database for agent storage
DATABASE_URL="file:./agents.db"
EOF
        log_success "Created ${UI_DIR}/.env.local"
    fi

    # Initialize Prisma database
    log_info "Initializing database..."
    cd "$UI_DIR"
    $SUDO npx prisma generate 2>/dev/null || true
    $SUDO npx prisma db push 2>/dev/null || true

    # Create startup script for UI
    $SUDO tee "${UI_DIR}/start.sh" > /dev/null << 'EOF'
#!/usr/bin/env bash
cd "$(dirname "$0")"
export NODE_ENV=production
export PORT=3000
exec npm run dev
EOF
    $SUDO chmod +x "${UI_DIR}/start.sh"

    # Create service with svcify
    create_frontend_service

    log_success "Frontend installation complete"
}

# Create frontend service using svcify
create_frontend_service() {
    if [ "$OS" == "macos" ]; then
        log_warn "svcify is for Linux only, skipping frontend service creation"
        return
    fi

    # Install svcify if not present
    if ! command -v svcify &> /dev/null; then
        if ! install_svcify; then
            log_warn "Skipping frontend service creation - svcify not available"
            return
        fi
    fi

    log_info "Creating frontend service with svcify..."

    UI_DIR="${INSTALL_DIR}/ui"
    if $SUDO svcify create griphook-ui --exec "${UI_DIR}/start.sh" --workdir "${UI_DIR}" --restart always --description "GRIPHOOK UI Dashboard"; then
        log_success "Created service with svcify: griphook-ui"
    else
        log_warn "svcify service creation failed, falling back to manual setup"
        create_frontend_service_fallback
    fi
}

# Fallback frontend service creation
create_frontend_service_fallback() {
    if [ -d /etc/systemd/system ] && [ "$OS" != "macos" ]; then
        log_info "Creating frontend systemd service (fallback)..."
        UI_DIR="${INSTALL_DIR}/ui"
        $SUDO tee /etc/systemd/system/griphook-ui.service > /dev/null << EOF
[Unit]
Description=GRIPHOOK UI Dashboard
After=network.target

[Service]
Type=simple
WorkingDirectory=${UI_DIR}
ExecStart=${UI_DIR}/start.sh
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF
        $SUDO systemctl daemon-reload
        log_success "Created systemd service: griphook-ui.service"
    fi
}

# Install via standalone JAR
install_jar_method() {
    log_info "Installing GRIPHOOK via standalone JAR..."

    # Check/install Java
    if ! check_java; then
        install_java
    fi

    # Create install directory
    $SUDO mkdir -p "$INSTALL_DIR"
    $SUDO mkdir -p "$INSTALL_DIR/data"

    # Download JAR from GitHub releases
    JAR_URL="https://github.com/${GITHUB_REPO}/releases/latest/download/runner-agent-backend.zip"

    log_info "Downloading GRIPHOOK agent..."
    if $SUDO curl -fsSL -o "/tmp/runner-agent-backend.zip" "$JAR_URL" 2>/dev/null; then
        $SUDO unzip -o /tmp/runner-agent-backend.zip -d "$INSTALL_DIR"
        $SUDO mv "$INSTALL_DIR"/*.jar "$INSTALL_DIR/griphook-agent.jar" 2>/dev/null || true
        rm -f /tmp/runner-agent-backend.zip
        log_success "Downloaded griphook-agent.jar"
    else
        log_warn "Could not download from releases, will build from source..."
        install_source_method
        return
    fi

    # Create default config
    create_env_file

    # Create startup script
    $SUDO tee "${INSTALL_DIR}/start.sh" > /dev/null << 'EOF'
#!/usr/bin/env bash
cd "$(dirname "$0")"
set -a
source .env
set +a
exec java -Xmx512m -jar griphook-agent.jar
EOF
    $SUDO chmod +x "${INSTALL_DIR}/start.sh"

    # Create service with svcify
    create_service_with_svcify

    # Install frontend (skipped in agent-only mode)
    if [ "$AGENT_ONLY" -eq 1 ]; then
        log_warn "Skipping frontend install (--agent-only): agent-only mode"
    else
        install_frontend
    fi

    # Interactive configuration
    configure_env_interactive

    log_success "JAR installation complete"
}

# Install via building from source
install_source_method() {
    log_info "Installing GRIPHOOK from source..."

    # Check/install Java
    if ! check_java; then
        install_java
    fi

    # Check for git
    if ! command -v git &> /dev/null; then
        log_info "Installing git..."
        case "$PKG_MANAGER" in
            apt) $SUDO apt-get install -y git ;;
            dnf) $SUDO dnf install -y git ;;
            pacman) $SUDO pacman -Sy --noconfirm git ;;
            zypper) $SUDO zypper install -y git ;;
            brew) brew install git ;;
        esac
    fi

    # Create install directory
    $SUDO mkdir -p "$INSTALL_DIR"
    $SUDO mkdir -p "$INSTALL_DIR/data"

    # Clone and build (trap ensures temp dir is removed on success, error, or Ctrl-C)
    TEMP_DIR=$(mktemp -d)
    trap 'cd /; rm -rf "$TEMP_DIR"; trap - EXIT' EXIT
    cd "$TEMP_DIR"

    log_info "Cloning repository..."
    git clone --depth 1 "https://github.com/${GITHUB_REPO}.git" griphook
    cd griphook

    log_info "Building with Gradle (this takes a few minutes)..."
    chmod +x gradlew
    ./gradlew bootJar --no-daemon

    $SUDO cp build/libs/*.jar "${INSTALL_DIR}/griphook-agent.jar"

    log_success "Built griphook-agent.jar"

    # Create default config
    create_env_file

    # Create startup script
    $SUDO tee "${INSTALL_DIR}/start.sh" > /dev/null << 'EOF'
#!/usr/bin/env bash
cd "$(dirname "$0")"
set -a
source .env
set +a
exec java -Xmx512m -jar griphook-agent.jar
EOF
    $SUDO chmod +x "${INSTALL_DIR}/start.sh"

    # Create service with svcify
    create_service_with_svcify

    # Install frontend (skipped in agent-only mode)
    if [ "$AGENT_ONLY" -eq 1 ]; then
        log_warn "Skipping frontend install (--agent-only): agent-only mode"
    else
        install_frontend
    fi

    # Interactive configuration
    configure_env_interactive

    log_success "Source installation complete"
}

# Install cli-executor (standalone command-runner microservice).
# Downloads cli-executor.zip from GitHub releases and registers a service:
#   - Linux: svcify (with systemd fallback)
#   - Windows: nssm.exe (auto-downloaded if absent)
#   - macOS: no service; user runs start.sh manually
install_cli_executor_method() {
    log_info "Installing cli-executor..."

    # Check/install Java
    if ! check_java; then
        install_java
    fi

    # Resolve install dir per OS
    local ce_dir
    if [ "$OS" == "windows" ]; then
        ce_dir="${CLI_EXECUTOR_INSTALL_DIR:-/c/cli-executor}"
    else
        ce_dir="${CLI_EXECUTOR_INSTALL_DIR:-/opt/cli-executor}"
    fi

    # Create install directory
    if [ "$OS" == "windows" ]; then
        mkdir -p "$ce_dir"
    else
        $SUDO mkdir -p "$ce_dir"
    fi

    # Download cli-executor.zip from GitHub releases
    local zip_url="https://github.com/${GITHUB_REPO}/releases/latest/download/cli-executor.zip"
    local tmp_zip="/tmp/cli-executor.zip"
    log_info "Downloading cli-executor from releases..."
    if curl -fsSL -o "$tmp_zip" "$zip_url"; then
        if command -v unzip &> /dev/null; then
            if [ "$OS" == "windows" ]; then
                unzip -o "$tmp_zip" -d "$ce_dir"
            else
                $SUDO unzip -o "$tmp_zip" -d "$ce_dir"
            fi
        elif [ "$OS" == "windows" ] && command -v powershell &> /dev/null; then
            local win_tmp win_ce
            win_tmp=$(cygpath -w "$tmp_zip" 2>/dev/null || echo "$tmp_zip")
            win_ce=$(cygpath -w "$ce_dir" 2>/dev/null || echo "$ce_dir")
            powershell -NoProfile -Command "Expand-Archive -Force -Path '$win_tmp' -DestinationPath '$win_ce'"
        else
            log_error "unzip not found; install unzip and re-run"
            exit 1
        fi
        rm -f "$tmp_zip"
        # Normalize jar name
        if [ "$OS" == "windows" ]; then
            mv "$ce_dir"/*.jar "$ce_dir/cli-executor.jar" 2>/dev/null || true
        else
            $SUDO mv "$ce_dir"/*.jar "$ce_dir/cli-executor.jar" 2>/dev/null || true
        fi
        log_success "Downloaded cli-executor.jar"
    else
        log_error "Could not download cli-executor from GitHub releases"
        log_info "Build it yourself: cd cli-executor && ./gradlew bootJar"
        exit 1
    fi

    # Token: explicit > existing .env > auto-generate
    local ce_token="${CLI_EXECUTOR_TOKEN:-}"
    if [ -f "${ce_dir}/.env" ]; then
        ce_token=$(grep -E '^SPRING_APPLICATION_TOKEN=' "${ce_dir}/.env" 2>/dev/null | cut -d'=' -f2-)
    fi
    if [ -z "$ce_token" ]; then
        if command -v openssl &> /dev/null; then
            ce_token=$(openssl rand -hex 24)
        else
            ce_token=$(head -c 24 /dev/urandom | xxd -p | tr -d '\n')
        fi
    fi

    # Create .env
    if [ ! -f "${ce_dir}/.env" ]; then
        if [ "$OS" == "windows" ]; then
            printf 'SPRING_APPLICATION_TOKEN=%s\nSERVER_PORT=%s\n' "$ce_token" "$CLI_EXECUTOR_PORT" > "${ce_dir}/.env"
        else
            $SUDO tee "${ce_dir}/.env" > /dev/null << EOF
SPRING_APPLICATION_TOKEN=${ce_token}
SERVER_PORT=${CLI_EXECUTOR_PORT}
EOF
        fi
        log_success "Created ${ce_dir}/.env"
    fi

    # Create start script
    if [ "$OS" == "windows" ]; then
        cat > "${ce_dir}/start.bat" << 'EOF'
@echo off
cd /d "%~dp0"
for /f "usebackq tokens=1,* delims==" %%a in (".env") do set "%%a=%%b"
java -jar cli-executor.jar
EOF
    else
        $SUDO tee "${ce_dir}/start.sh" > /dev/null << 'EOF'
#!/usr/bin/env bash
cd "$(dirname "$0")"
set -a
source .env
set +a
exec java -jar cli-executor.jar
EOF
        $SUDO chmod +x "${ce_dir}/start.sh"
    fi

    # Register service
    case "$OS" in
        windows) create_cli_executor_service_windows "$ce_dir" "$ce_token" ;;
        macos)   log_warn "svcify is Linux only; on macOS run ${ce_dir}/start.sh manually" ;;
        *)       create_cli_executor_service_linux "$ce_dir" ;;
    esac

    # Stash for print_next_steps (read back regardless of how we got it)
    CLI_EXECUTOR_DIR_OUT="$ce_dir"
    CLI_EXECUTOR_TOKEN_OUT="$ce_token"

    log_success "cli-executor installation complete"
}

# Create cli-executor service with svcify (Linux)
create_cli_executor_service_linux() {
    local ce_dir="$1"
    if ! install_svcify; then
        log_warn "Skipping service creation - svcify not available"
        return
    fi
    if $SUDO svcify create cli-executor \
        --exec "${ce_dir}/start.sh" \
        --workdir "${ce_dir}" \
        --restart always \
        --description "GRIPHOOK CLI Executor"; then
        log_success "Created service with svcify: cli-executor"
    else
        log_warn "svcify failed, falling back to systemd"
        $SUDO tee /etc/systemd/system/cli-executor.service > /dev/null << EOF
[Unit]
Description=GRIPHOOK CLI Executor
After=network.target

[Service]
Type=simple
WorkingDirectory=${ce_dir}
ExecStart=${ce_dir}/start.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
        $SUDO systemctl daemon-reload
        log_success "Created systemd service: cli-executor.service"
    fi
}

# Create cli-executor service with nssm.exe (Windows). Auto-downloads nssm if missing.
create_cli_executor_service_windows() {
    local ce_dir="$1"
    local ce_token="$2"

    # Locate nssm.exe
    local nssm_cmd=""
    if command -v nssm &> /dev/null; then
        nssm_cmd="nssm"
    elif [ -x "${ce_dir}/nssm.exe" ]; then
        nssm_cmd="${ce_dir}/nssm.exe"
    else
        log_info "Downloading nssm.exe..."
        local nssm_url="https://nssm.cc/release/nssm-2.24.zip"
        if curl -fsSL -o /tmp/nssm.zip "$nssm_url"; then
            local nssm_extract="/tmp/nssm-extract"
            if command -v unzip &> /dev/null; then
                unzip -o /tmp/nssm.zip -d "$nssm_extract"
            elif command -v powershell &> /dev/null; then
                local win_zip win_ex
                win_zip=$(cygpath -w /tmp/nssm.zip 2>/dev/null || echo "C:\\Windows\\Temp\\nssm.zip")
                win_ex=$(cygpath -w "$nssm_extract" 2>/dev/null || echo "C:\\Windows\\Temp\\nssm-extract")
                powershell -NoProfile -Command "Expand-Archive -Force -Path '$win_zip' -DestinationPath '$win_ex'"
            fi
            cp "$nssm_extract"/nssm-2.24/win64/nssm.exe "${ce_dir}/nssm.exe" 2>/dev/null || \
              cp "$nssm_extract"/*/win64/nssm.exe "${ce_dir}/nssm.exe" 2>/dev/null || true
            rm -rf /tmp/nssm.zip "$nssm_extract"
            [ -x "${ce_dir}/nssm.exe" ] && nssm_cmd="${ce_dir}/nssm.exe"
        fi
    fi

    if [ -z "$nssm_cmd" ]; then
        log_error "nssm.exe not available. Install with: choco install nssm"
        log_info "Then run manually: ${ce_dir}\\start.bat"
        return
    fi

    # Convert Git Bash path to Windows path for nssm
    local win_dir win_jar
    win_dir=$(cygpath -w "$ce_dir" 2>/dev/null || echo "C:\\cli-executor")
    win_jar="${win_dir}\\cli-executor.jar"

    "$nssm_cmd" install cli-executor java -jar "$win_jar"
    "$nssm_cmd" set cli-executor AppDirectory "$win_dir"
    "$nssm_cmd" set cli-executor AppEnvironmentExtra "SPRING_APPLICATION_TOKEN=${ce_token}" "SERVER_PORT=${CLI_EXECUTOR_PORT}"
    "$nssm_cmd" set cli-executor Start SERVICE_AUTO_START
    "$nssm_cmd" start cli-executor
    log_success "Created Windows service: cli-executor"
}

# Create .env.bak file
create_env_file() {
    if [ ! -f "${INSTALL_DIR}/.env" ]; then
        log_info "Creating default configuration..."

        # Pick a free port for the default (8090, bumped by +100 if in use).
        local default_port
        default_port=$(find_free_port 8090)
        if [ "$default_port" != "8090" ]; then
            log_warn "Default port 8090 is in use, using ${default_port} instead."
        fi

        $SUDO tee "${INSTALL_DIR}/.env" > /dev/null << EOF
# GRIPHOOK Configuration
# Generate a secure token: openssl rand -hex 32
AGENT_TOKEN=change-me-to-secure-token

# Google AI API Key (required for AI chat)
# Get one at: https://aistudio.google.com/apikey
GOOGLE_AI_API_KEY=

# Server settings
SERVER_PORT=${default_port}
AGENT_WORKING_DIR=/tmp
AGENT_DEFAULT_SHELL=/bin/bash
AGENT_MAX_CONCURRENT=5

# AI Model (gemini-2.0-flash, gemini-1.5-pro, etc.)
AGENT_ADK_MODEL=gemini-2.0-flash
AGENT_ADK_ENABLED=true
EOF
        log_success "Created ${INSTALL_DIR}/.env"
    fi
}

# Interactive configuration for essential env variables
configure_env_interactive() {
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════${NC}"
    echo -e "${CYAN}         Quick Configuration                ${NC}"
    echo -e "${CYAN}════════════════════════════════════════════${NC}"
    echo ""

    echo -e "${BOLD}Would you like to configure essential settings now?${NC}"
    echo -e "${DIM}(You can always edit ${INSTALL_DIR}/.env later)${NC}"
    echo ""
    echo -n "Configure now? [Y/n]: "
    read configure_choice < /dev/tty

    if [[ "$configure_choice" =~ ^[Nn]$ ]]; then
        log_info "Skipping configuration. Edit ${INSTALL_DIR}/.env manually."
        return
    fi

    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}1. Google AI API Key ${RED}(Required for AI Chat)${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "   Get your free API key at:"
    echo -e "   ${CYAN}https://aistudio.google.com/apikey${NC}"
    echo ""
    echo -n "   Enter your Google AI API Key: "
    read -r google_api_key < /dev/tty

    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}2. Agent Token ${DIM}(API Authentication)${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "   This token secures your GRIPHOOK API."
    echo -e "   ${DIM}Press Enter to auto-generate a secure token, or enter your own.${NC}"
    echo ""
    echo -n "   Enter Agent Token [auto-generate]: "
    read -r agent_token < /dev/tty

    # Auto-generate token if empty
    if [ -z "$agent_token" ]; then
        if command -v openssl &> /dev/null; then
            agent_token=$(openssl rand -hex 32)
        else
            agent_token=$(head -c 32 /dev/urandom | xxd -p | tr -d '\n')
        fi
        echo -e "   ${GREEN}Generated:${NC} ${agent_token:0:16}..."
    fi

    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}3. Server Port ${DIM}(Default: 8090)${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "   ${DIM}If the default is in use, we'll auto-bump by +100 until a free port is found.${NC}"
    echo -n "   Enter Server Port [8090]: "
    read -r server_port < /dev/tty
    server_port=${server_port:-8090}

    # Validate the chosen port is free; if not, auto-bump by +100 until free.
    local suggested_port
    suggested_port=$(find_free_port "$server_port")
    if [ "$suggested_port" != "$server_port" ]; then
        log_warn "Port ${server_port} is in use. Using ${suggested_port} instead."
        server_port="$suggested_port"
    fi

    # Update the .env.bak file
    log_info "Updating configuration..."

    ENV_FILE="${INSTALL_DIR}/.env"

    # Helper function to update or add env variable
    update_env_var() {
        local key="$1"
        local value="$2"
        if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
            $SUDO sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
        else
            echo "${key}=${value}" | $SUDO tee -a "$ENV_FILE" > /dev/null
        fi
    }

    if [ -n "$google_api_key" ]; then
        update_env_var "GOOGLE_AI_API_KEY" "$google_api_key"
    fi

    if [ -n "$agent_token" ]; then
        update_env_var "AGENT_TOKEN" "$agent_token"
    fi

    if [ -n "$server_port" ]; then
        update_env_var "SERVER_PORT" "$server_port"
    fi

    echo ""
    log_success "Configuration saved to ${ENV_FILE}"

    # Show summary
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}         Configuration Summary              ${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "   ${CYAN}Google AI API Key:${NC} ${google_api_key:+configured}${google_api_key:-not set}"
    echo -e "   ${CYAN}Agent Token:${NC}       ${agent_token:0:16}..."
    echo -e "   ${CYAN}Server Port:${NC}       ${server_port}"
    echo ""
}

# Install svcify for service management
install_svcify() {
    if command -v svcify &> /dev/null; then
        log_success "svcify already installed"
        return 0
    fi

    log_info "Installing svcify for service management..."

    # Install svcify from GitHub (auto-confirm with 'y')
    SVCIFY_URL="https://raw.githubusercontent.com/noodlescripter/svcify/main/svcify.sh"

    if echo "y" | curl -fsSL "$SVCIFY_URL" | $SUDO bash; then
        log_success "svcify installed"
        return 0
    else
        log_warn "Could not install svcify automatically"
        log_info "Install manually: curl -fsSL $SVCIFY_URL | bash"
        return 1
    fi
}

# Create service using svcify
create_service_with_svcify() {
    if [ "$OS" == "macos" ]; then
        log_warn "svcify is for Linux only, skipping service creation"
        return
    fi

    # Install svcify if not present
    if ! install_svcify; then
        log_warn "Skipping service creation - svcify not available"
        return
    fi

    log_info "Creating service with svcify..."

    # Use svcify to create the service
    cd "$INSTALL_DIR"
    if $SUDO svcify create griphook --exec "${INSTALL_DIR}/start.sh" --workdir "${INSTALL_DIR}" --restart always --description "GRIPHOOK AI-Powered Deployment Agent"; then
        log_success "Created service with svcify: griphook"
    else
        log_warn "svcify service creation failed, falling back to manual setup"
        # Fallback: create service file directly
        create_systemd_service_fallback
    fi
}

# Fallback systemd service creation (if svcify fails)
create_systemd_service_fallback() {
    if [ -d /etc/systemd/system ] && [ "$OS" != "macos" ]; then
        log_info "Creating systemd service (fallback)..."
        $SUDO tee /etc/systemd/system/griphook.service > /dev/null << EOF
[Unit]
Description=GRIPHOOK Agent
After=network.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
ExecStart=${INSTALL_DIR}/start.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
        $SUDO systemctl daemon-reload
        log_success "Created systemd service: griphook.service"
    fi
}

# Print next steps based on installation method
print_next_steps() {
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════${NC}"
    echo -e "${GREEN}         Installation Complete!             ${NC}"
    echo -e "${GREEN}════════════════════════════════════════════${NC}"
    echo ""

    if [ "$AGENT_ONLY" -eq 1 ]; then
        echo -e "  ${CYAN}Mode:${NC} ${YELLOW}Agent only (no UI on this host)${NC}"
        echo ""
        echo -e "  ${CYAN}API:${NC}    http://localhost:8090"
        echo -e "  ${CYAN}Health:${NC} http://localhost:8090/health"
        echo ""
        echo -e "  ${CYAN}To manage this agent, add it to an existing GRIPHOOK UI:${NC}"
        echo -e "     1. Open your UI dashboard (e.g. http://<ui-host>:3000)"
        echo -e "     2. Go to Agents -> Add Agent"
        echo -e "     3. Enter this host URL: http://<this-host>:8090"
        echo -e "     4. Paste the AGENT_TOKEN shown below"
        echo ""
    fi

    case "$INSTALL_METHOD" in
        docker)
            echo -e "  ${CYAN}1.${NC} Containers are already running. Edit config and restart to apply:"
            echo -e "     ${YELLOW}sudo nano ${INSTALL_DIR}/.env${NC}"
            echo -e "     ${YELLOW}cd ${INSTALL_DIR} && sudo docker compose up -d${NC}"
            echo ""
            echo -e "  ${CYAN}2.${NC} Check status:"
            echo -e "     ${YELLOW}cd ${INSTALL_DIR} && sudo docker compose ps${NC}"
            echo ""
            echo -e "  ${CYAN}3.${NC} View logs:"
            echo -e "     ${YELLOW}cd ${INSTALL_DIR} && sudo docker compose logs -f${NC}"
            echo ""
            echo -e "  ${CYAN}4.${NC} Access the dashboard:"
            echo -e "     ${YELLOW}http://localhost:3000${NC}  (UI)"
            echo -e "     ${YELLOW}http://localhost:8090${NC}  (API)"
            ;;
        jar|source)
            echo -e "  ${CYAN}1.${NC} Configure your API keys:"
            echo -e "     ${YELLOW}sudo nano ${INSTALL_DIR}/.env${NC}"
            echo ""
            echo -e "  ${CYAN}2.${NC} Start the services:"
            if command -v svcify &> /dev/null; then
                echo -e "     ${YELLOW}sudo svcify start griphook${NC}       # Backend API"
                if [ "$AGENT_ONLY" -ne 1 ]; then
                    echo -e "     ${YELLOW}sudo svcify start griphook-ui${NC}    # Frontend UI"
                    echo ""
                    echo -e "     ${DIM}Enable auto-start on boot:${NC}"
                    echo -e "     ${YELLOW}sudo svcify enable griphook griphook-ui${NC}"
                else
                    echo ""
                    echo -e "     ${DIM}Enable auto-start on boot:${NC}"
                    echo -e "     ${YELLOW}sudo svcify enable griphook${NC}"
                fi
            elif [ -f /etc/systemd/system/griphook.service ]; then
                echo -e "     ${YELLOW}sudo systemctl start griphook${NC}       # Backend API"
                if [ "$AGENT_ONLY" -ne 1 ]; then
                    echo -e "     ${YELLOW}sudo systemctl start griphook-ui${NC}    # Frontend UI"
                    echo ""
                    echo -e "     ${DIM}Enable auto-start on boot:${NC}"
                    echo -e "     ${YELLOW}sudo systemctl enable griphook griphook-ui${NC}"
                else
                    echo ""
                    echo -e "     ${DIM}Enable auto-start on boot:${NC}"
                    echo -e "     ${YELLOW}sudo systemctl enable griphook${NC}"
                fi
            else
                echo -e "     ${YELLOW}${INSTALL_DIR}/start.sh${NC}       # Backend"
                if [ "$AGENT_ONLY" -ne 1 ]; then
                    echo -e "     ${YELLOW}${INSTALL_DIR}/ui/start.sh${NC}    # Frontend"
                fi
            fi
            echo ""
            echo -e "  ${CYAN}3.${NC} Check health:"
            echo -e "     ${YELLOW}curl http://localhost:8090/health${NC}"
            echo ""
            echo -e "  ${CYAN}4.${NC} View logs:"
            if command -v svcify &> /dev/null; then
                echo -e "     ${YELLOW}sudo svcify logs griphook${NC}       # Backend logs"
                if [ "$AGENT_ONLY" -ne 1 ]; then
                    echo -e "     ${YELLOW}sudo svcify logs griphook-ui${NC}    # Frontend logs"
                fi
            elif [ -f /etc/systemd/system/griphook.service ]; then
                echo -e "     ${YELLOW}sudo journalctl -u griphook -f${NC}       # Backend logs"
                if [ "$AGENT_ONLY" -ne 1 ]; then
                    echo -e "     ${YELLOW}sudo journalctl -u griphook-ui -f${NC}    # Frontend logs"
                fi
            else
                echo -e "     (logs output to terminal)"
            fi
            echo ""
            if [ "$AGENT_ONLY" -ne 1 ]; then
                echo -e "  ${CYAN}5.${NC} Access the dashboard:"
                echo -e "     ${YELLOW}http://localhost:3000${NC}  (UI)"
                echo -e "     ${YELLOW}http://localhost:8090${NC}  (API)"
            fi
            ;;
        sandbox)
            echo -e "  ${CYAN}1.${NC} Enter the sandbox container:"
            echo -e "     ${YELLOW}docker exec -it griphook-sandbox bash${NC}"
            echo ""
            echo -e "  ${CYAN}2.${NC} Inside the container, install GRIPHOOK:"
            echo -e "     ${YELLOW}curl -fsSL https://griphook.dev/install.sh | bash${NC}"
            echo -e "     ${DIM}Then choose option 2 (Standalone JAR) or 3 (Build from Source)${NC}"
            echo ""
            echo -e "  ${CYAN}3.${NC} Container management:"
            echo -e "     ${YELLOW}docker stop griphook-sandbox${NC}     # Stop"
            echo -e "     ${YELLOW}docker start griphook-sandbox${NC}    # Start"
            echo -e "     ${YELLOW}docker logs griphook-sandbox${NC}     # View logs"
            echo ""
            echo -e "  ${CYAN}4.${NC} Access from host (after installing inside):"
            echo -e "     ${YELLOW}http://localhost:3000${NC}  (UI)"
            echo -e "     ${YELLOW}http://localhost:8090${NC}  (API)"
            ;;
        cli-executor)
            echo -e "  ${CYAN}cli-executor${NC} runs on port ${CLI_EXECUTOR_PORT} (default 8010)."
            echo ""
            if [ "$OS" == "windows" ]; then
                echo -e "  ${CYAN}1.${NC} Start / manage the service (nssm):"
                echo -e "     ${YELLOW}nssm start cli-executor${NC}      # start"
                echo -e "     ${YELLOW}nssm stop cli-executor${NC}       # stop"
                echo -e "     ${YELLOW}nssm restart cli-executor${NC}    # restart"
                echo -e "     ${YELLOW}nssm status cli-executor${NC}     # status"
                echo ""
                echo -e "  ${CYAN}2.${NC} Or run manually:"
                echo -e "     ${YELLOW}${CLI_EXECUTOR_DIR_OUT}\\start.bat${NC}"
            elif command -v svcify &> /dev/null; then
                echo -e "  ${CYAN}1.${NC} Start / manage the service (svcify):"
                echo -e "     ${YELLOW}sudo svcify start cli-executor${NC}"
                echo -e "     ${YELLOW}sudo svcify enable cli-executor${NC}   # auto-start on boot"
                echo ""
                echo -e "  ${CYAN}2.${NC} Or run manually:"
                echo -e "     ${YELLOW}${CLI_EXECUTOR_DIR_OUT}/start.sh${NC}"
            elif [ -f /etc/systemd/system/cli-executor.service ]; then
                echo -e "  ${CYAN}1.${NC} Start / manage the service (systemd):"
                echo -e "     ${YELLOW}sudo systemctl start cli-executor${NC}"
                echo -e "     ${YELLOW}sudo systemctl enable cli-executor${NC}"
                echo ""
                echo -e "  ${CYAN}2.${NC} Or run manually:"
                echo -e "     ${YELLOW}${CLI_EXECUTOR_DIR_OUT}/start.sh${NC}"
            else
                echo -e "  ${CYAN}1.${NC} Run manually:"
                echo -e "     ${YELLOW}${CLI_EXECUTOR_DIR_OUT}/start.sh${NC}"
            fi
            echo ""
            echo -e "  ${CYAN}3.${NC} Health check:"
            echo -e "     ${YELLOW}curl http://localhost:${CLI_EXECUTOR_PORT}/executor/health${NC}"
            echo -e "     ${DIM}(expect: OK)${NC}"
            echo ""
            echo -e "  ${CYAN}4.${NC} Call it (token in request body, not a header):"
            echo -e "     ${YELLOW}curl -X POST http://localhost:${CLI_EXECUTOR_PORT}/executor/run \\${NC}"
            echo -e "       ${YELLOW}-H 'content-type: application/json' \\${NC}"
            echo -e "       ${YELLOW}-d '{\"commands\":[\"uptime\"],\"token\":\"<your-token>\"}'${NC}"
            echo ""
            echo -e "  ${CYAN}Docs:${NC} https://github.com/${GITHUB_REPO}#cli-executor"
            ;;
    esac

    echo ""
    echo -e "  ${CYAN}Documentation:${NC} https://github.com/${GITHUB_REPO}"
    echo ""

    # Show the agent token so the user can copy it (read back from .env.bak so it
    # works even when config was skipped because .env.bak already existed).
    if [ "$INSTALL_METHOD" == "cli-executor" ]; then
        if [ -n "${CLI_EXECUTOR_TOKEN_OUT:-}" ]; then
            echo -e "${GREEN}════════════════════════════════════════════${NC}"
            echo -e "${GREEN}         Your CLI Executor Token           ${NC}"
            echo -e "${GREEN}════════════════════════════════════════════${NC}"
            echo ""
            echo -e "  ${CYAN}SPRING_APPLICATION_TOKEN:${NC} ${YELLOW}${CLI_EXECUTOR_TOKEN_OUT}${NC}"
            echo ""
            echo -e "  ${DIM}Send this token in the POST /executor/run body (not a header).${NC}"
            echo -e "  ${DIM}Both runner-agent's skill body and cli-executor must share it.${NC}"
            echo ""
            echo -e "  ${DIM}Example:${NC}"
            echo -e "  ${YELLOW}curl -X POST http://localhost:${CLI_EXECUTOR_PORT}/executor/run \\${NC}"
            echo -e "    ${YELLOW}-H 'content-type: application/json' \\${NC}"
            echo -e "    ${YELLOW}-d '{\"commands\":[\"echo hi\"],\"token\":\"${CLI_EXECUTOR_TOKEN_OUT}\"}'${NC}"
            echo ""
        fi
        return
    fi
    local env_file="${INSTALL_DIR}/.env"
    if [ -f "$env_file" ]; then
        local saved_token
        saved_token=$(grep -E '^AGENT_TOKEN=' "$env_file" 2>/dev/null | cut -d'=' -f2-)
        local saved_port
        saved_port=$(grep -E '^SERVER_PORT=' "$env_file" 2>/dev/null | cut -d'=' -f2-)
        if [ -n "$saved_token" ]; then
            echo -e "${GREEN}════════════════════════════════════════════${NC}"
            echo -e "${GREEN}             Your Agent Token               ${NC}"
            echo -e "${GREEN}════════════════════════════════════════════${NC}"
            echo ""
            echo -e "  ${CYAN}AGENT_TOKEN:${NC} ${YELLOW}${saved_token}${NC}"
            echo ""
            echo -e "  ${DIM}Save this token. You'll need it to authenticate${NC}"
            echo -e "  ${DIM}API requests and to connect the CLI/UI to the agent.${NC}"
            echo ""
            echo -e "  ${DIM}Example:${NC}"
            echo -e "  ${YELLOW}curl http://localhost:${saved_port:-8090}/health \\${NC}"
            echo -e "    ${YELLOW}-H \"Authorization: Bearer ${saved_token}\"${NC}"
            echo ""
        fi
    fi
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --docker)
                INSTALL_METHOD="docker"
                shift
                ;;
            --jar)
                INSTALL_METHOD="jar"
                shift
                ;;
            --source)
                INSTALL_METHOD="source"
                shift
                ;;
            --sandbox)
                INSTALL_METHOD="sandbox"
                shift
                ;;
            --cli-executor)
                INSTALL_METHOD="cli-executor"
                shift
                ;;
            --agent-only)
                AGENT_ONLY=1
                shift
                ;;
            --help|-h)
                echo "GRIPHOOK Installer"
                echo ""
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --docker      Install via Docker Compose (recommended)"
                echo "  --jar         Install standalone JAR with svcify service"
                echo "  --source      Build from source with svcify service"
                echo "  --sandbox     Run in Ubuntu sandbox container (for testing)"
                echo "  --cli-executor  Install the cli-executor microservice (svcify on Linux,"
                echo "                nssm.exe on Windows)"
                echo "  --agent-only  Install only the backend agent (no UI). Use when"
                echo "                you already have a UI instance and want to add"
                echo "                another agent to it."
                echo "  --help        Show this help message"
                echo ""
                echo "Environment variables:"
                echo "  INSTALL_DIR    Installation directory (default: /opt/griphook)"
                echo ""
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
}

# Main
main() {
    parse_args "$@"

    print_banner
    detect_os
    check_privileges

    # Show menu if no method specified
    if [ -z "$INSTALL_METHOD" ]; then
        show_menu
    fi

    # Run installation based on method
    case "$INSTALL_METHOD" in
        docker)
            install_docker_method
            ;;
        jar)
            install_jar_method
            ;;
        source)
            install_source_method
            ;;
        sandbox)
            install_sandbox_method
            ;;
        cli-executor)
            install_cli_executor_method
            ;;
    esac

    print_next_steps
}

main "$@"
