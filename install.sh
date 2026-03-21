#!/usr/bin/env bash
#
# GRIPHOOK Installer
# Installs JDK 21, Node.js 24, and the GRIPHOOK agent
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
GRIPHOOK_VERSION="${GRIPHOOK_VERSION:-0.1.0-SNAPSHOT}"
INSTALL_DIR="${INSTALL_DIR:-/opt/griphook}"
GITHUB_REPO="nullruntime-dev/runner-agent"
JAR_NAME="runner-agent-${GRIPHOOK_VERSION}.jar"

# Required versions
REQUIRED_JAVA_VERSION=21
REQUIRED_NODE_VERSION=24

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

# Get installed Java version
get_java_version() {
    if command -v java &> /dev/null; then
        java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1
    else
        echo "0"
    fi
}

# Get installed Node.js version
get_node_version() {
    if command -v node &> /dev/null; then
        node --version | cut -d'v' -f2 | cut -d'.' -f1
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
            # Link for macOS
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

# Install Node.js 24
install_node() {
    log_info "Installing Node.js ${REQUIRED_NODE_VERSION}..."

    case "$PKG_MANAGER" in
        apt)
            # Use NodeSource repository for latest Node.js
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
            curl -fsSL https://rpm.nodesource.com/setup_${REQUIRED_NODE_VERSION}.x | $SUDO bash -
            $SUDO zypper install -y nodejs
            ;;
        brew)
            brew install node@24 || brew install node
            ;;
        *)
            log_error "Unsupported package manager: $PKG_MANAGER"
            log_info "Please install Node.js ${REQUIRED_NODE_VERSION} manually and re-run this script"
            exit 1
            ;;
    esac

    log_success "Node.js ${REQUIRED_NODE_VERSION} installed"
}

# Check and install dependencies
check_dependencies() {
    log_info "Checking dependencies..."

    # Check Java
    JAVA_VERSION=$(get_java_version)
    if [ "$JAVA_VERSION" -ge "$REQUIRED_JAVA_VERSION" ]; then
        log_success "Java ${JAVA_VERSION} found (required: ${REQUIRED_JAVA_VERSION}+)"
    else
        if [ "$JAVA_VERSION" -eq "0" ]; then
            log_warn "Java not found"
        else
            log_warn "Java ${JAVA_VERSION} found, but ${REQUIRED_JAVA_VERSION}+ required"
        fi
        install_java
    fi

    # Check Node.js
    NODE_VERSION=$(get_node_version)
    if [ "$NODE_VERSION" -ge "$REQUIRED_NODE_VERSION" ]; then
        log_success "Node.js ${NODE_VERSION} found (required: ${REQUIRED_NODE_VERSION}+)"
    else
        if [ "$NODE_VERSION" -eq "0" ]; then
            log_warn "Node.js not found"
        else
            log_warn "Node.js ${NODE_VERSION} found, but ${REQUIRED_NODE_VERSION}+ required"
        fi
        install_node
    fi
}

# Download and install GRIPHOOK
install_griphook() {
    log_info "Installing GRIPHOOK to ${INSTALL_DIR}..."

    # Create install directory
    $SUDO mkdir -p "$INSTALL_DIR"
    $SUDO mkdir -p "$INSTALL_DIR/data"

    # Download JAR from GitHub releases
    JAR_URL="https://github.com/${GITHUB_REPO}/releases/latest/download/${JAR_NAME}"

    log_info "Downloading GRIPHOOK agent..."
    if ! $SUDO curl -fsSL -o "${INSTALL_DIR}/griphook-agent.jar" "$JAR_URL" 2>/dev/null; then
        log_warn "Could not download from releases, trying to build from source..."
        build_from_source
    else
        log_success "Downloaded griphook-agent.jar"
    fi

    # Create default config
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

    log_success "GRIPHOOK installed to ${INSTALL_DIR}"
}

# Build from source if release not available
build_from_source() {
    log_info "Building from source..."

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

    # Clone and build
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"

    git clone --depth 1 "https://github.com/${GITHUB_REPO}.git" griphook
    cd griphook

    chmod +x gradlew
    ./gradlew bootJar --no-daemon

    $SUDO cp "build/libs/runner-agent-${GRIPHOOK_VERSION}.jar" "${INSTALL_DIR}/griphook-agent.jar"

    # Cleanup
    cd /
    rm -rf "$TEMP_DIR"

    log_success "Built and installed griphook-agent.jar"
}

# Print next steps
print_next_steps() {
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════${NC}"
    echo -e "${GREEN}         Installation Complete!             ${NC}"
    echo -e "${GREEN}════════════════════════════════════════════${NC}"
    echo ""
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
    echo ""
    echo -e "  ${CYAN}Documentation:${NC} https://github.com/${GITHUB_REPO}"
    echo ""
}

# Main
main() {
    print_banner
    detect_os
    check_privileges
    check_dependencies
    install_griphook
    print_next_steps
}

main "$@"
