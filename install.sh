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

# Required versions
REQUIRED_JAVA_VERSION=21
REQUIRED_NODE_VERSION=22

# Installation method (set by menu or CLI arg)
INSTALL_METHOD=""

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
    echo -e "  ${RED}q)${NC} ${BOLD}Quit${NC}"
    echo ""

    while true; do
        echo -n "Enter choice [1-3, q]: "
        read choice < /dev/tty
        case "$choice" in
            1) INSTALL_METHOD="docker"; break ;;
            2) INSTALL_METHOD="jar"; break ;;
            3) INSTALL_METHOD="source"; break ;;
            q|Q) echo "Cancelled."; exit 0 ;;
            *) echo -e "${RED}Invalid choice. Please enter 1, 2, 3, or q.${NC}" ;;
        esac
    done
}

# Detect OS and package manager
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
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

    # Create .env file
    if [ ! -f ".env" ]; then
        log_info "Creating default configuration..."
        $SUDO tee .env > /dev/null << 'EOF'
# GRIPHOOK Configuration
# Generate a secure token: openssl rand -hex 32
AGENT_TOKEN=change-me-to-secure-token

# Google AI API Key (required for AI chat)
# Get one at: https://aistudio.google.com/apikey
GOOGLE_AI_API_KEY=

# AI Model
AGENT_ADK_MODEL=gemini-2.0-flash
AGENT_ADK_ENABLED=true
EOF
        log_success "Created ${INSTALL_DIR}/.env"
    fi

    # Pull images
    log_info "Pulling Docker images..."
    $SUDO docker compose pull

    log_success "Docker installation complete"
}

# Get installed Java version
get_java_version() {
    if command -v java &> /dev/null; then
        java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1
    else
        echo "0"
    fi
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

    # Create .env.local for UI
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

    # Install frontend
    install_frontend

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

    # Clone and build
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"

    log_info "Cloning repository..."
    git clone --depth 1 "https://github.com/${GITHUB_REPO}.git" griphook
    cd griphook

    log_info "Building with Gradle..."
    chmod +x gradlew
    ./gradlew bootJar --no-daemon

    $SUDO cp build/libs/*.jar "${INSTALL_DIR}/griphook-agent.jar"

    # Cleanup
    cd /
    rm -rf "$TEMP_DIR"

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

    # Install frontend
    install_frontend

    log_success "Source installation complete"
}

# Create .env file
create_env_file() {
    if [ ! -f "${INSTALL_DIR}/.env" ]; then
        log_info "Creating default configuration..."
        $SUDO tee "${INSTALL_DIR}/.env" > /dev/null << 'EOF'
# GRIPHOOK Configuration
# Generate a secure token: openssl rand -hex 32
AGENT_TOKEN=change-me-to-secure-token

# Google AI API Key (required for AI chat)
# Get one at: https://aistudio.google.com/apikey
GOOGLE_AI_API_KEY=

# Server settings
SERVER_PORT=8090
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

# Install svcify for service management
install_svcify() {
    if command -v svcify &> /dev/null; then
        log_success "svcify already installed"
        return 0
    fi

    log_info "Installing svcify for service management..."

    # Install svcify from GitHub
    SVCIFY_URL="https://raw.githubusercontent.com/noodlescripter/svcify/main/install.sh"

    if curl -fsSL "$SVCIFY_URL" | $SUDO bash; then
        log_success "svcify installed"
        return 0
    else
        log_warn "Could not install svcify automatically"
        log_info "Install manually: curl -fsSL $SVCIFY_URL | sudo bash"
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

    case "$INSTALL_METHOD" in
        docker)
            echo -e "  ${CYAN}1.${NC} Configure your API keys:"
            echo -e "     ${YELLOW}sudo nano ${INSTALL_DIR}/.env${NC}"
            echo ""
            echo -e "  ${CYAN}2.${NC} Start the services:"
            echo -e "     ${YELLOW}cd ${INSTALL_DIR} && sudo docker compose up -d${NC}"
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
                echo -e "     ${YELLOW}sudo svcify start griphook-ui${NC}    # Frontend UI"
                echo ""
                echo -e "     ${DIM}Enable auto-start on boot:${NC}"
                echo -e "     ${YELLOW}sudo svcify enable griphook griphook-ui${NC}"
            elif [ -f /etc/systemd/system/griphook.service ]; then
                echo -e "     ${YELLOW}sudo systemctl start griphook${NC}       # Backend API"
                echo -e "     ${YELLOW}sudo systemctl start griphook-ui${NC}    # Frontend UI"
                echo ""
                echo -e "     ${DIM}Enable auto-start on boot:${NC}"
                echo -e "     ${YELLOW}sudo systemctl enable griphook griphook-ui${NC}"
            else
                echo -e "     ${YELLOW}${INSTALL_DIR}/start.sh${NC}       # Backend"
                echo -e "     ${YELLOW}${INSTALL_DIR}/ui/start.sh${NC}    # Frontend"
            fi
            echo ""
            echo -e "  ${CYAN}3.${NC} Check health:"
            echo -e "     ${YELLOW}curl http://localhost:8090/health${NC}"
            echo ""
            echo -e "  ${CYAN}4.${NC} View logs:"
            if command -v svcify &> /dev/null; then
                echo -e "     ${YELLOW}sudo svcify logs griphook${NC}       # Backend logs"
                echo -e "     ${YELLOW}sudo svcify logs griphook-ui${NC}    # Frontend logs"
            elif [ -f /etc/systemd/system/griphook.service ]; then
                echo -e "     ${YELLOW}sudo journalctl -u griphook -f${NC}       # Backend logs"
                echo -e "     ${YELLOW}sudo journalctl -u griphook-ui -f${NC}    # Frontend logs"
            else
                echo -e "     (logs output to terminal)"
            fi
            echo ""
            echo -e "  ${CYAN}5.${NC} Access the dashboard:"
            echo -e "     ${YELLOW}http://localhost:3000${NC}  (UI)"
            echo -e "     ${YELLOW}http://localhost:8090${NC}  (API)"
            ;;
    esac

    echo ""
    echo -e "  ${CYAN}Documentation:${NC} https://github.com/${GITHUB_REPO}"
    echo ""
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
            --help|-h)
                echo "GRIPHOOK Installer"
                echo ""
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --docker    Install via Docker Compose (recommended)"
                echo "  --jar       Install standalone JAR with systemd service"
                echo "  --source    Build from source"
                echo "  --help      Show this help message"
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
    esac

    print_next_steps
}

main "$@"
