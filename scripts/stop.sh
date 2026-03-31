#!/usr/bin/env bash
# stop.sh — Stop the Personal Context Bridge.
# Usage: bash scripts/stop.sh
set -euo pipefail

VENV_DIR=".venv"
ACTIVATE="${VENV_DIR}/bin/activate"

# ── Helpers ────────────────────────────────────────────────────────────────────
red()   { echo -e "\033[0;31m$*\033[0m"; }
green() { echo -e "\033[0;32m$*\033[0m"; }
info()  { echo -e "\033[0;34m➜ $*\033[0m"; }

# ── Pre-flight ─────────────────────────────────────────────────────────────────
if [ ! -f "$ACTIVATE" ]; then
    red "Virtual environment not found. Nothing to stop."
    exit 1
fi

# shellcheck source=/dev/null
source "$ACTIVATE"

# ── Stop ───────────────────────────────────────────────────────────────────────
info "Stopping Personal Context Bridge..."
python pcb.py stop

green "✅ PCB stopped."
