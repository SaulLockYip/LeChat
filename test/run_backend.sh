#!/bin/bash
# =============================================================================
# LeChat Backend Test Runner
# =============================================================================
# This script runs Go tests for the backend services.
#
# Usage:
#   ./test/run_backend.sh           Run all backend tests
#   ./test/run_backend.sh -v       Verbose output
#   ./test/run_backend.sh ./pkg/... Run specific package tests
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LECHAT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Default test flags
VERBOSE=""
COVER=""
TARGET="${1:-./...}"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE="-v"
            shift
            ;;
        -cover)
            COVER="-cover"
            shift
            ;;
        *)
            TARGET="$1"
            shift
            ;;
    esac
done

echo "=============================================="
echo "  Running Backend Tests"
echo "=============================================="
echo ""
echo "Test target: ${TARGET}"
echo "Working directory: ${LECHAT_ROOT}"
echo ""

# Change to backend directory
cd "${LECHAT_ROOT}"

# Check if there are any Go files with tests
if ! grep -r "_test\.go" . --include="*.go" &> /dev/null; then
    echo "[WARN] No Go test files found in ${LECHAT_ROOT}"
    echo "[INFO] Backend tests will be added when test files are created"
    exit 0
fi

# Run Go tests
echo ">>> Executing: go test ${VERBOSE} ${COVER} ${TARGET}"
echo ""

if go test ${VERBOSE} ${COVER} ${TARGET}; then
    echo ""
    echo "[SUCCESS] Backend tests passed"
else
    echo ""
    echo "[FAIL] Backend tests failed"
    exit 1
fi

# Show coverage report if available
if [ -n "${COVER}" ]; then
    echo ""
    echo ">>> Coverage Report"
    echo "--------------------------------------"
    go test -coverprofile="${LECHAT_TEST_DIR:-/tmp}/coverage.out" ${TARGET} 2>/dev/null || true
    if [ -f "${LECHAT_TEST_DIR:-/tmp}/coverage.out" ]; then
        go tool cover -func="${LECHAT_TEST_DIR:-/tmp}/coverage.out" 2>/dev/null || true
    fi
fi

echo ""
echo "=============================================="
echo "  Backend Tests Completed"
echo "=============================================="
