#!/bin/bash
# =============================================================================
# LeChat Test Setup - Prepare Test Environment
# =============================================================================
# This script sets up the test environment before running tests.
# It handles:
#   - Creating temporary test directories
#   - Initializing test databases
#   - Setting up mock services
#   - Verifying dependencies
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LECHAT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Load environment variables if not already set
export LECHAT_TEST_DIR="${LECHAT_TEST_DIR:-${LECHAT_ROOT}/.test_tmp}"
export LECHAT_MOCK_OPENCLAW="${LECHAT_MOCK_OPENCLAW:-true}"
export TEST_TOKEN="${TEST_TOKEN:-test-token-$(date +%s)}"
export LEARCH_DB_PATH="${LECHAT_TEST_DIR}/test.db"
export LECHAT_HTTP_PORT="${LECHAT_HTTP_PORT:-8081}"
export LECHAT_WS_PORT="${LECHAT_WS_PORT:-8082}"

echo "[SETUP] Preparing test environment..."

# -----------------------------------------------------------------------------
# 1. Create test directory
# -----------------------------------------------------------------------------
echo "[SETUP] Creating test directory: ${LECHAT_TEST_DIR}"
mkdir -p "${LECHAT_TEST_DIR}"

# -----------------------------------------------------------------------------
# 2. Verify Go installation (for backend tests)
# -----------------------------------------------------------------------------
if command -v go &> /dev/null; then
    echo "[SETUP] Go version: $(go version)"
else
    echo "[SETUP] Warning: Go not found - backend tests may fail"
fi

# -----------------------------------------------------------------------------
# 3. Verify Node.js installation (for frontend/E2E tests)
# -----------------------------------------------------------------------------
if command -v node &> /dev/null; then
    echo "[SETUP] Node version: $(node --version)"
    echo "[SETUP] NPM version: $(npm --version)"
else
    echo "[SETUP] Warning: Node.js not found - frontend tests may fail"
fi

# -----------------------------------------------------------------------------
# 4. Initialize test database (SQLite)
# -----------------------------------------------------------------------------
if [ -f "${LEARCH_DB_PATH}" ]; then
    echo "[SETUP] Removing existing test database..."
    rm -f "${LEARCH_DB_PATH}"
fi

echo "[SETUP] Test database path: ${LEARCH_DB_PATH}"

# -----------------------------------------------------------------------------
# 5. Install frontend dependencies if needed
# -----------------------------------------------------------------------------
if [ -d "${LECHAT_ROOT}/web/node_modules" ]; then
    echo "[SETUP] Frontend dependencies already installed"
else
    echo "[SETUP] Installing frontend dependencies..."
    cd "${LECHAT_ROOT}/web" && npm install
fi

# -----------------------------------------------------------------------------
# 6. Check for Playwright installation
# -----------------------------------------------------------------------------
if npx playwright --version &> /dev/null; then
    echo "[SETUP] Playwright is available"
else
    echo "[SETUP] Installing Playwright..."
    cd "${LECHAT_ROOT}/web" && npm install -D @playwright/test
    npx playwright install chromium
fi

# -----------------------------------------------------------------------------
# 7. Create mock OpenClaw configuration
# -----------------------------------------------------------------------------
if [ "${LECHAT_MOCK_OPENCLAW}" = "true" ]; then
    echo "[SETUP] Mock OpenClaw enabled"
    export OPENCLAW_API_URL="http://localhost:9999/mock"
    export OPENCLAW_API_KEY="mock-test-key"
fi

# -----------------------------------------------------------------------------
# 8. Build backend if needed
# -----------------------------------------------------------------------------
if [ -f "${LECHAT_ROOT}/server" ]; then
    echo "[SETUP] Server binary already exists"
else
    echo "[SETUP] Building server..."
    cd "${LECHAT_ROOT}" && go build -o server ./cmd/server
fi

echo "[SETUP] Test environment ready"
