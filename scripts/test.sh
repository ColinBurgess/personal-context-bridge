#!/usr/bin/env bash
# test.sh — Run backend and frontend test suites.
# Usage: bash scripts/test.sh
set -euo pipefail

VENV_DIR=".venv"
ACTIVATE="${VENV_DIR}/bin/activate"

if [ ! -f "$ACTIVATE" ]; then
    echo "Virtual environment not found. Run 'bash scripts/install.sh' first."
    exit 1
fi

# shellcheck source=/dev/null
source "$ACTIVATE"

pytest
npm --prefix frontend test
