#!/usr/bin/env bash
# frontend-dev.sh — Start React frontend in development mode.
# Usage: bash scripts/frontend-dev.sh
set -euo pipefail

if [ ! -f "frontend/package.json" ]; then
    echo "frontend/package.json not found."
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo "npm is required to run the frontend dev server."
    exit 1
fi

npm --prefix frontend run dev
