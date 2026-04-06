#!/usr/bin/env bash
# restore.sh — Import memories from a JSON backup file.
# Usage:
#   bash scripts/restore.sh backups/file.json
#   bash scripts/restore.sh backups/file.json append
#   bash scripts/restore.sh backups/file.json replace
set -euo pipefail

VENV_DIR=".venv"
ACTIVATE="${VENV_DIR}/bin/activate"

if [ ! -f "$ACTIVATE" ]; then
    echo "Virtual environment not found. Run 'bash scripts/install.sh' first."
    exit 1
fi

if [ "${1:-}" = "" ]; then
    echo "Usage: bash scripts/restore.sh <backup_file.json> [append|replace]"
    exit 1
fi

BACKUP_FILE="$1"
MODE="${2:-append}"

if [ "$MODE" != "append" ] && [ "$MODE" != "replace" ]; then
    echo "Invalid mode: $MODE"
    echo "Mode must be: append | replace"
    exit 1
fi

# shellcheck source=/dev/null
source "$ACTIVATE"
python scripts/memory_backup.py restore --input "$BACKUP_FILE" --mode "$MODE"
