#!/usr/bin/env bash
# status.sh — Show current PCB process status.
# Usage: bash scripts/status.sh
set -euo pipefail

VENV_DIR=".venv"
ACTIVATE="${VENV_DIR}/bin/activate"

if [ ! -f "$ACTIVATE" ]; then
    echo "Virtual environment not found. Run 'bash scripts/install.sh' first."
    exit 1
fi

# shellcheck source=/dev/null
source "$ACTIVATE"

python pcb.py status
