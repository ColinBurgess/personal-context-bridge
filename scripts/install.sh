#!/usr/bin/env bash
# install.sh — Set up the Personal Context Bridge environment.
# Usage: bash scripts/install.sh
set -euo pipefail

VENV_DIR=".venv"
PYTHON_MIN_VERSION="3.11"
FRONTEND_DIR="frontend"

# ── Helpers ────────────────────────────────────────────────────────────────────
red()   { echo -e "\033[0;31m$*\033[0m"; }
green() { echo -e "\033[0;32m$*\033[0m"; }
info()  { echo -e "\033[0;34m➜ $*\033[0m"; }

require_command() {
    command -v "$1" &>/dev/null || { red "ERROR: '$1' is required but not found."; exit 1; }
}

python_version_ok() {
    local version
    version=$("$1" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null)
    python3 -c "
import sys
cur = tuple(int(x) for x in '${version}'.split('.'))
min_ = tuple(int(x) for x in '${PYTHON_MIN_VERSION}'.split('.'))
sys.exit(0 if cur >= min_ else 1)
" 2>/dev/null
}

# ── Pre-flight checks ──────────────────────────────────────────────────────────
info "Checking requirements..."
require_command python3

if ! python_version_ok python3; then
    red "Python ${PYTHON_MIN_VERSION}+ is required. Found: $(python3 --version)"
    exit 1
fi
green "  Python OK: $(python3 --version)"

# ── Virtual environment ────────────────────────────────────────────────────────
if [ -d "$VENV_DIR" ]; then
    info "Virtual environment already exists at '${VENV_DIR}', skipping creation."
else
    info "Creating virtual environment at '${VENV_DIR}'..."
    python3 -m venv "$VENV_DIR"
    green "  Virtual environment created."
fi

# ── Activate & install dependencies ───────────────────────────────────────────
# shellcheck source=/dev/null
source "${VENV_DIR}/bin/activate"

info "Installing dependencies from requirements.txt..."
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
green "  Dependencies installed."

if [ -d "$FRONTEND_DIR" ] && [ -f "$FRONTEND_DIR/package.json" ]; then
    require_command npm
    info "Installing frontend dependencies in '${FRONTEND_DIR}'..."
    npm --prefix "$FRONTEND_DIR" install --silent
    green "  Frontend dependencies installed."
fi

# ── Done ───────────────────────────────────────────────────────────────────────
echo ""
green "✅ Installation complete!"
echo ""
echo "  To start the application, run:"
echo "    bash scripts/start.sh"
echo ""
