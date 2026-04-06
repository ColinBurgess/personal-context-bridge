#!/usr/bin/env bash
# backup.sh — Export all memories to a JSON backup file.
# Usage:
#   bash scripts/backup.sh
#   bash scripts/backup.sh backups/my_backup.json
set -euo pipefail

VENV_DIR=".venv"
ACTIVATE="${VENV_DIR}/bin/activate"

if [ ! -f "$ACTIVATE" ]; then
    echo "Virtual environment not found. Run 'bash scripts/install.sh' first."
    exit 1
fi

# shellcheck source=/dev/null
source "$ACTIVATE"

if [ "${1:-}" != "" ]; then
    python scripts/memory_backup.py backup --output "$1"
else
    python scripts/memory_backup.py backup
fi
