#!/usr/bin/env bash
# start.sh — Start the Personal Context Bridge (backend + UI).
# Usage: bash scripts/start.sh
set -euo pipefail

VENV_DIR=".venv"
ACTIVATE="${VENV_DIR}/bin/activate"

# ── Helpers ────────────────────────────────────────────────────────────────────
red()   { echo -e "\033[0;31m$*\033[0m"; }
green() { echo -e "\033[0;32m$*\033[0m"; }
info()  { echo -e "\033[0;34m➜ $*\033[0m"; }

# ── Pre-flight ─────────────────────────────────────────────────────────────────
if [ ! -f "$ACTIVATE" ]; then
    red "Virtual environment not found. Run 'bash scripts/install.sh' first."
    exit 1
fi

# shellcheck source=/dev/null
source "$ACTIVATE"

# ── Launch ─────────────────────────────────────────────────────────────────────
info "Starting Personal Context Bridge..."
python pcb.py start

green "✅ PCB is running."
echo ""
echo "  API  → http://localhost:8000"
echo "  Web  → http://localhost:3000 (React default)"
echo "  Web  → http://localhost:8501 (if PCB_UI_MODE=streamlit)"
echo "  Docs → http://localhost:8000/docs"
echo ""
echo "  To start with Streamlit UI: PCB_UI_MODE=streamlit bash scripts/start.sh"
echo "  Run 'bash scripts/stop.sh' to shut down."
