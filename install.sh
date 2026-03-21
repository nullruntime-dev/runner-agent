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
    echo -e "     ${DIM}Download JAR and run with Java 21. Creates systemd service.${NC}"
    echo ""
    echo -e "  ${MAGENTA}3)${NC} ${BOLD}Build from Source${NC}"
    echo -e "     ${DIM}Clone repo and build with Gradle. For development.${NC}"
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

    # Create systemd service
    create_systemd_service

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

    # Create systemd service
    create_systemd_service

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

# Create systemd service
create_systemd_service() {
    if [ -d /etc/systemd/system ] && [ "$OS" != "macos" ]; then
        log_info "Creating systemd service..."
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
            echo -e "  ${CYAN}2.${NC} Start the agent:"
            if [ -f /etc/systemd/system/griphook.service ]; then
                echo -e "     ${YELLOW}sudo systemctl start griphook${NC}"
                echo -e "     ${YELLOW}sudo systemctl enable griphook${NC}  # auto-start on boot"
            else
                echo -e "     ${YELLOW}${INSTALL_DIR}/start.sh${NC}"
            fi
            echo ""
            echo -e "  ${CYAN}3.${NC} Check health:"
            echo -e "     ${YELLOW}curl http://localhost:8090/health${NC}"
            echo ""
            echo -e "  ${CYAN}4.${NC} View logs:"
            if [ -f /etc/systemd/system/griphook.service ]; then
                echo -e "     ${YELLOW}sudo journalctl -u griphook -f${NC}"
            else
                echo -e "     (logs output to terminal)"
            fi
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
