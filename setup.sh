#!/bin/bash
set -e

# =============================================================================
# LeChat Setup Script
# =============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo ""
    echo -e "${CYAN}${BOLD}========================================${NC}"
    echo -e "${CYAN}${BOLD}  LeChat Setup${NC}"
    echo -e "${CYAN}${BOLD}========================================${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_info() {
    echo -e "${BOLD}[INFO]${NC} $1"
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# =============================================================================
# Check Required Tools
# =============================================================================

check_required_tools() {
    print_step "Checking required tools..."

    local missing=()

    if ! command_exists go; then
        missing+=("go")
    fi

    if ! command_exists npm; then
        missing+=("npm")
    fi

    if ! command_exists jq; then
        missing+=("jq")
    fi

    if [ ${#missing[@]} -ne 0 ]; then
        print_error "Missing required tools: ${missing[*]}"
        echo "Please install the missing tools and try again."
        exit 1
    fi

    print_success "All required tools are installed"
}

# =============================================================================
# Validate OpenClaw Directory
# =============================================================================

validate_openclaw_dir() {
    local openclaw_dir="$1"

    if [ ! -d "$openclaw_dir" ]; then
        print_error "OpenClaw directory does not exist: $openclaw_dir"
        return 1
    fi

    if [ ! -f "$openclaw_dir/openclaw.json" ]; then
        print_error "openclaw.json not found in: $openclaw_dir"
        return 1
    fi

    print_success "OpenClaw directory validated: $openclaw_dir"
    return 0
}

# =============================================================================
# Validate Port Availability
# =============================================================================

validate_port() {
    local port="$1"

    if ! [[ "$port" =~ ^[0-9]+$ ]] || [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
        print_error "Invalid port number: $port (must be 1-65535)"
        return 1
    fi

    # Check if port is available (only on macOS/BSD)
    if command_exists lsof; then
        if lsof -i :"$port" >/dev/null 2>&1; then
            print_error "Port $port is already in use"
            return 1
        fi
    elif command_exists netstat; then
        if netstat -an 2>/dev/null | grep -q "\\.$port "; then
            print_error "Port $port is already in use"
            return 1
        fi
    fi

    print_success "Port $port is available"
    return 0
}

# =============================================================================
# Validate LeChat Directory
# =============================================================================

validate_lechat_dir() {
    local lechat_dir="$1"

    if [ -d "$lechat_dir" ]; then
        echo ""
        print_warning "LeChat directory already exists: $lechat_dir"
        echo "  [1] Overwrite (delete and recreate)"
        echo "  [2] Choose a different directory"
        echo "  [3] Cancel setup"
        echo ""
        read -p "Select option [1]: " overwrite_option
        overwrite_option=${overwrite_option:-1}

        case "$overwrite_option" in
            1)
                print_info "Removing existing directory..."
                if [ "$lechat_dir" = "/" ] || [ -z "$lechat_dir" ]; then
                    print_error "Refusing to delete root directory"
                    return 3
                fi
                read -p "Are you sure you want to delete '$lechat_dir'? Type 'yes' to confirm: " confirm
                if [ "$confirm" != "yes" ]; then
                    print_info "Deletion cancelled"
                    return 3
                fi
                rm -rf "$lechat_dir"
                ;;
            3)
                print_info "Setup cancelled"
                exit 0
                ;;
            *)
                print_error "Invalid option: $overwrite_option"
                return 3
                ;;
        esac
    fi

    return 0
}

# =============================================================================
# Main Setup
# =============================================================================

main() {
    print_header

    # Check required tools first
    check_required_tools

    # Step 1: OpenClaw Directory
    echo ""
    read -p "OpenClaw directory [~/.openclaw]: " openclaw_dir
    openclaw_dir=${openclaw_dir:-~/.openclaw}
    openclaw_dir="${openclaw_dir/#\~/$HOME}"

    if ! validate_openclaw_dir "$openclaw_dir"; then
        exit 1
    fi

    # Step 2: LeChat Directory
    while true; do
        echo ""
        read -p "LeChat directory [~/.lechat]: " lechat_dir
        lechat_dir=${lechat_dir:-~/.lechat}
        lechat_dir="${lechat_dir/#\~/$HOME}"

        validate_lechat_dir "$lechat_dir"
        result=$?

        if [ $result -eq 0 ]; then
            break
        elif [ $result -eq 2 ]; then
            continue
        else
            exit 1
        fi
    done

    # Step 3: Port
    echo ""
    read -p "Port [28275]: " port
    port=${port:-28275}

    if ! validate_port "$port"; then
        exit 1
    fi

    # =============================================================================
    # Initialization Steps
    # =============================================================================

    print_step "Creating directory structure..."
    mkdir -p "$lechat_dir/bin"
    mkdir -p "$lechat_dir/messages"
    print_success "Created directories: $lechat_dir/bin/, $lechat_dir/messages/"

    # Generate config.json
    print_step "Generating config.json..."
    cat > "$lechat_dir/config.json" << EOF
{
  "lechat_dir": "$lechat_dir",
  "openclaw_dir": "$openclaw_dir",
  "db_path": "$lechat_dir/lechat.db",
  "socket_path": "$lechat_dir/socket.sock",
  "http_port": $port
}
EOF
    print_success "Created config.json"

    # Get the project root directory
    PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

    # Build Go projects
    print_step "Building Go projects..."

    print_info "Building CLI..."
    cd "$PROJECT_ROOT"
    if ! go build -o "$lechat_dir/bin/cli" ./cmd/cli; then
        print_error "Failed to build CLI"
        exit 1
    fi
    print_success "Built CLI -> $lechat_dir/bin/cli"

    print_info "Building server..."
    if ! go build -o "$lechat_dir/bin/server" ./cmd/server; then
        print_error "Failed to build server"
        exit 1
    fi
    print_success "Built server -> $lechat_dir/bin/server"

    # Build React frontend
    print_step "Building React frontend..."

    cd "$PROJECT_ROOT/web"
    if ! npm install --silent 2>/dev/null; then
        print_error "Failed to install npm dependencies"
        exit 1
    fi
    print_success "Installed npm dependencies"

    if ! npm run build; then
        print_error "Failed to build frontend"
        exit 1
    fi

    # Move the output to the lechat_dir
    if [ -d "$PROJECT_ROOT/web/out" ]; then
        mv "$PROJECT_ROOT/web/out" "$lechat_dir/web"
        print_success "Frontend built -> $lechat_dir/web/"
    elif [ -d "$PROJECT_ROOT/web/.next" ]; then
        mv "$PROJECT_ROOT/web/.next" "$lechat_dir/web"
        print_success "Frontend built -> $lechat_dir/web/"
    else
        print_warning "Frontend build output not found"
    fi

    # Add to PATH
    print_step "Adding LeChat to PATH..."

    local shell_rc=""
    if [ -n "$ZSH_VERSION" ]; then
        shell_rc="$HOME/.zshrc"
    elif [ -n "$BASH_VERSION" ]; then
        shell_rc="$HOME/.bashrc"
    else
        shell_rc="$HOME/.zshrc"
    fi

    local path_export="export PATH=\$HOME/.lechat/bin:\$PATH"
    if ! grep -q "\.lechat/bin" "$shell_rc" 2>/dev/null; then
        echo "" >> "$shell_rc"
        echo "# LeChat" >> "$shell_rc"
        echo "$path_export" >> "$shell_rc"
        print_success "Added to $shell_rc"
    else
        print_info "PATH already configured in $shell_rc"
    fi

    # =============================================================================
    # Summary
    # =============================================================================

    echo ""
    echo -e "${GREEN}${BOLD}========================================${NC}"
    echo -e "${GREEN}${BOLD}  Setup Complete!${NC}"
    echo -e "${GREEN}${BOLD}========================================${NC}"
    echo ""
    echo -e "  ${BOLD}LeChat installed at:${NC} $lechat_dir"
    echo -e "  ${BOLD}Config file:${NC} $lechat_dir/config.json"
    echo -e "  ${BOLD}Port:${NC} $port"
    echo ""
    echo -e "  ${BOLD}Binaries:${NC}"
    echo -e "    - $lechat_dir/bin/cli"
    echo -e "    - $lechat_dir/bin/server"
    echo ""
    echo -e "  ${YELLOW}Please run the following to use LeChat immediately:${NC}"
    echo -e "    ${CYAN}source $shell_rc${NC}"
    echo -e "    ${CYAN}lechat-cli${NC}"
    echo ""
}

# Run main function
main "$@"
