#!/usr/bin/env bash
# frontend-build.sh — Build React frontend for production.
# Usage: bash scripts/frontend-build.sh
set -euo pipefail

if [ ! -f "frontend/package.json" ]; then
    echo "frontend/package.json not found."
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo "npm is required to build the frontend."
    exit 1
fi

npm --prefix frontend run build
