# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

## [Unreleased]

## [1.0.8] - 2026-04-07
- Add timestamped launcher logs with simple rotation for `.pcb_logs`
- Add Database UI actions for full backup export and DB import (`append` / `replace`)
- Add note-level backup export from the record detail modal
- Add note import flow from JSON files in the Database view
- Add backend payload restore endpoint for browser-driven imports (`POST /restore_memories_payload`)
- Document runtime log behavior and UI backup/import flows in README
- Expand backend tests for payload restore support

## [1.0.7] - 2026-04-06
- Migrate memory storage from localStorage to ChromaDB filesystem persistence
- Add backup and restore endpoints (`POST /backup_memories`, `POST /restore_memories`) with append/replace modes
- Add `DELETE /delete_memory/{memory_id}` API endpoint
- Add CORS middleware for Vite dev proxy compatibility
- Add Vite proxy config routing `/api/*` to backend to avoid CORS issues in dev
- Add `fetchWithTimeout()` with AbortController (15s) to prevent silent UI hangs
- Decouple save success feedback from post-save list refresh (non-blocking)
- Add `normalizeMemory()` to handle legacy ChromaDB entries without `full_memory` field
- Add real operation logs in UI replacing fake messages (`ClientLog` + `addLog()`)
- Add status banner in Database tab for delete and error feedback
- Add `scripts/backup.sh`, `scripts/restore.sh`, `scripts/memory_backup.py` utilities
- Expand test suite: 9 frontend regression tests + 16 backend unit/integration tests
- Add `tests/test_persistence_integration.py` for real filesystem save/delete verification

## [1.0.6] - 2026-04-01
- Add PM2 controller script and docs for laptop service management

## [1.0.5] - 2026-04-01
- Add project roadmap with optional macOS packaging track

## [1.0.4] - 2026-04-01
- Improve input UX with example placeholder and guarded save flow

## [1.0.3] - 2026-03-31
- Add LLM instructions modal and copy press feedback

## [1.0.2] - 2026-03-31
- Add delete confirmation modal in database view

## [1.0.1] - 2026-03-31
- Improve responsive layout and add AGENTS guidance

## [1.0.0] - 2026-03-31
- Reorganized the project into backend, frontend, and scripts modules.
- Added install, start, stop, status, frontend, and test scripts.
- Switched the default UI to the React application.
- Added backend and frontend automated test suites.
- Improved process management, logging, and responsive layout behavior.
- Added centralized versioning and changelog workflow.
