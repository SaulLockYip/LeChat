#!/bin/bash
# =============================================================================
# LeChat Test Teardown - Cleanup After Tests
# =============================================================================
# This script cleans up the test environment after tests complete.
# It handles:
#   - Stopping test servers
#   - Removing temporary files
#   - Cleaning up test databases
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LECHAT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LECHAT_TEST_DIR="${LECHAT_TEST_DIR:-${LECHAT_ROOT}/.test_tmp}"

echo "[TEARDOWN] Cleaning up test environment..."

# -----------------------------------------------------------------------------
# 1. Stop any running test servers
# -----------------------------------------------------------------------------
if [ -n "${TEST_SERVER_PID}" ] && kill -0 "${TEST_SERVER_PID}" 2>/dev/null; then
    echo "[TEARDOWN] Stopping test server (PID: ${TEST_SERVER_PID})"
    kill "${TEST_SERVER_PID}" 2>/dev/null || true
fi

# Kill any server processes on test ports
for port in "${LECHAT_HTTP_PORT:-8081}" "${LECHAT_WS_PORT:-8082}"; do
    if lsof -i :${port} &> /dev/null; then
        echo "[TEARDOWN] Killing process on port ${port}"
        lsof -i :${port} | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null || true
    fi
done

# -----------------------------------------------------------------------------
# 2. Remove test database
# -----------------------------------------------------------------------------
if [ -f "${LECHAT_TEST_DIR}/test.db" ]; then
    echo "[TEARDOWN] Removing test database"
    rm -f "${LECHAT_TEST_DIR}/test.db"
fi

# -----------------------------------------------------------------------------
# 3. Clean up test directory (optional - comment out to preserve artifacts)
# -----------------------------------------------------------------------------
# echo "[TEARDOWN] Removing test directory: ${LECHAT_TEST_DIR}"
# rm -rf "${LECHAT_TEST_DIR}"

# -----------------------------------------------------------------------------
# 4. Kill any background processes started during tests
# -----------------------------------------------------------------------------
# Clean up any remaining background jobs
jobs -p | xargs kill 2>/dev/null || true

echo "[TEARDOWN] Teardown complete"
