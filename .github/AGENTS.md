# AGENTS.md

## Scope
- Python backend in `backend/`, React frontend in `frontend/`, operational scripts in `scripts/`.
- Key files: `backend/api.py`, `backend/memory.py`, `backend/mcp_server.py`, `frontend/src/App.tsx`, `pcb.py`, `tests/`.

## Canonical Commands
- Install: `bash scripts/install.sh`
- Start: `bash scripts/start.sh`
- Stop: `bash scripts/stop.sh`
- Status: `bash scripts/status.sh`
- Test: `bash scripts/test.sh`
- Frontend dev: `bash scripts/frontend-dev.sh`
- Release: `bash scripts/release.sh [major|minor|patch] "message"`

## Defaults
- React UI is the default on `http://localhost:3000`.
- Backend API runs on `http://localhost:8000`.
- Streamlit is optional via `PCB_UI_MODE=streamlit`.

## Do
- Read `README.md` before changing workflow or project structure.
- Use scripts in `scripts/` as the default interface to install, run, test, and release.
- Keep changes minimal, local, and easy to validate.
- Treat `VERSION` as the single source of truth.
- Run `bash scripts/test.sh` before closing meaningful changes.

## Don't
- Don't hardcode version values in multiple places.
- Don't commit generated files, caches, logs, virtualenvs, or local data.
- Don't replace shared flows with one-off commands unless intentionally redesigning the repo.
- Don't skip `start`, `status`, and `stop` validation when touching process management.