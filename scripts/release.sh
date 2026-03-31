#!/usr/bin/env bash
# release.sh — Bump version and append a changelog entry.
# Usage: bash scripts/release.sh patch "Fix responsive home layout"
set -euo pipefail

VENV_DIR=".venv"
ACTIVATE="${VENV_DIR}/bin/activate"

if [ ! -f "$ACTIVATE" ]; then
    echo "Virtual environment not found. Run 'bash scripts/install.sh' first."
    exit 1
fi

# shellcheck source=/dev/null
source "$ACTIVATE"

python scripts/release.py "$@"
