#!/bin/bash
# =============================================================================
# LeChat Test Runner - Run All Tests
# =============================================================================
# This script runs all tests (backend, frontend unit, frontend E2E).
# It is typically called by the main test.sh script.
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LECHAT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "=============================================="
echo "  Running All Tests"
echo "=============================================="
echo ""

# Run backend tests
echo ">>> Running Backend Tests"
echo "--------------------------------------"
"${SCRIPT_DIR}/run_backend.sh"
echo ""

# Run frontend tests
echo ">>> Running Frontend Unit Tests"
echo "--------------------------------------"
"${SCRIPT_DIR}/run_frontend.sh"
echo ""

# Run E2E tests
echo ">>> Running E2E Tests"
echo "--------------------------------------"
cd "${LECHAT_ROOT}/web" && npx playwright test

echo ""
echo "=============================================="
echo "  All Tests Completed"
echo "=============================================="
