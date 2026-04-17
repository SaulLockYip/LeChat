#!/bin/bash
# =============================================================================
# LeChat Test Pipeline - Main Entry Point
# =============================================================================
# This script orchestrates the complete test suite for LeChat, including:
#   - Backend Go tests
#   - Frontend unit tests
#   - Frontend E2E tests (Playwright)
#
# Usage:
#   ./test.sh              Run all tests
#   ./test.sh --backend    Backend tests only
#   ./test.sh --frontend   Frontend tests only
#   ./test.sh --e2e        E2E tests only
# =============================================================================

set -e

# Determine script directory regardless of symlinks
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="${SCRIPT_DIR}/test"
LECHAT_ROOT="${SCRIPT_DIR}"

# Load environment variables
if [ -f "${LECHAT_ROOT}/.env.test" ]; then
    echo "=== Loading test environment variables ==="
    set -a
    source "${LECHAT_ROOT}/.env.test"
    set +a
fi

# Set defaults
export LECHAT_TEST_DIR="${LECHAT_TEST_DIR:-${LECHAT_ROOT}/.test_tmp}"
export LECHAT_MOCK_OPENCLAW="${LECHAT_MOCK_OPENCLAW:-true}"
export TEST_TOKEN="${TEST_TOKEN:-test-token-$(date +%s)}"

# Parse arguments
MODE="${1:-all}"

# =============================================================================
# Functions
# =============================================================================

log_info() {
    echo "[INFO] $1"
}

log_success() {
    echo "[SUCCESS] $1"
}

log_error() {
    echo "[ERROR] $1" >&2
}

cleanup_on_error() {
    log_error "Test pipeline failed. Running teardown..."
    "${TEST_DIR}/teardown.sh" || true
    exit 1
}

# Set error trap
trap cleanup_on_error ERR

# =============================================================================
# Main Test Pipeline
# =============================================================================

main() {
    echo ""
    echo "=============================================="
    echo "  LeChat Test Pipeline"
    echo "=============================================="
    echo ""
    log_info "Test directory: ${LECHAT_TEST_DIR}"
    log_info "Mode: ${MODE}"
    echo ""

    case "${MODE}" in
        --backend)
            log_info "Running backend tests only"
            "${TEST_DIR}/setup.sh"
            "${TEST_DIR}/run_backend.sh"
            "${TEST_DIR}/teardown.sh"
            ;;
        --frontend)
            log_info "Running frontend tests only"
            "${TEST_DIR}/setup.sh"
            "${TEST_DIR}/run_frontend.sh"
            "${TEST_DIR}/teardown.sh"
            ;;
        --e2e)
            log_info "Running E2E tests only"
            "${TEST_DIR}/setup.sh"
            npx playwright test
            "${TEST_DIR}/teardown.sh"
            ;;
        all)
            log_info "Running complete test suite"
            "${TEST_DIR}/setup.sh"
            "${TEST_DIR}/run_backend.sh"
            "${TEST_DIR}/run_frontend.sh"
            npx playwright test
            "${TEST_DIR}/teardown.sh"
            ;;
        *)
            log_error "Unknown mode: ${MODE}"
            echo "Usage: $0 [--backend|--frontend|--e2e|all]"
            exit 1
            ;;
    esac

    echo ""
    echo "=============================================="
    log_success "Test pipeline completed successfully"
    echo "=============================================="
}

main "$@"
