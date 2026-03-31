# Product Roadmap

This roadmap defines practical next steps for Personal Context Bridge.
It is designed to be easy to execute by humans and LLM agents.

## Scope

- Keep existing architecture stable: Python backend, React frontend, script-based operations.
- Prioritize incremental delivery with test coverage and changelog discipline.
- Include optional tracks that can be deferred without blocking core progress.

## Agent Execution Rules

Use this protocol when an LLM agent executes roadmap items:

1. Read this file and `README.md` before editing.
2. Implement only one roadmap item (or one phase of one item) per PR/commit.
3. Run validation commands before proposing completion.
4. Update docs affected by behavior changes.
5. Use `bash scripts/release.sh [major|minor|patch] "message"` for version/changelog updates.
6. Never skip tests for meaningful changes.

Definition of done for each item:

- Code implemented.
- Relevant tests added or updated.
- Documentation updated.
- Changelog entry prepared through release flow.

## Roadmap Tracks

## Track A: Core Reliability (Near-Term)

Goal: reduce operational surprises and improve daily development confidence.

### A1. Strengthen Startup Diagnostics

- Add clearer root-cause messages in startup/status flows.
- Include actionable hints when a service fails to boot.
- Validate with scripted failure scenarios.

Deliverables:

- Improved diagnostics in process orchestration.
- Tests for degraded/offline service states.

### A2. Input UX Hardening

- Keep safe defaults for memory input.
- Improve validation error clarity for malformed JSON.
- Add edge-case tests for empty and partial payloads.

Deliverables:

- Better user-facing error messages.
- Extended frontend tests around input state transitions.

## Track B: Data Safety and Portability (Near-Term)

Goal: make local data easier to protect and migrate.

### B1. Backup and Restore Commands

- Add scripts for export/import of `local_memory` data.
- Document backup frequency and restore steps.

Deliverables:

- `scripts/backup.sh` and `scripts/restore.sh` (or equivalent).
- Recovery playbook in README.

### B2. Memory Export Formats

- Provide JSONL export for external analysis.
- Add schema validation for exported records.

Deliverables:

- Export utility with deterministic output.
- Automated tests for export correctness.

## Track C: Quality and Delivery (Near-Term)

Goal: keep release quality predictable as the project grows.

### C1. CI Pipeline Baseline

- Run backend and frontend tests on every PR.
- Block merge when tests fail.

Deliverables:

- CI workflow file with test jobs.
- Badge and short CI section in README.

### C2. Test Coverage Visibility

- Add optional coverage report generation.
- Identify minimum coverage target by module.

Deliverables:

- Coverage script and report artifact support.
- Documented coverage baseline.

## Track D: Optional Packaging and Distribution

Goal: provide optional desktop-style installation paths without disrupting the current web-first architecture.

Status: optional. Not required for core functionality.

### D1. macOS PKG Packaging (Optional)

Objective:

- Deliver an installable `.pkg` that sets up PCB on macOS.

Important behavior note:

- A `.pkg` installer does not automatically make the UI native macOS.
- With this track alone, UI remains web-based (browser or webview launcher).

Phases:

1. Packaging skeleton
- Add `packaging/macos/` directory.
- Define install layout (app files, scripts, optional LaunchAgent/LaunchDaemon).

2. Build/install scripts
- Add repeatable script to assemble payload and build `.pkg`.
- Include postinstall checks for Python/runtime prerequisites.

3. Runtime integration
- Provide helper launcher command to open UI after service start.
- Ensure start/stop/status remain script-compatible.

4. Validation
- Test clean install, upgrade install, uninstall/cleanup paths.
- Verify persistence behavior of local data.

5. Distribution hardening (optional advanced)
- Add code signing and notarization workflow.
- Document Gatekeeper-compatible distribution process.

Deliverables:

- `packaging/macos/` with scripts and installer metadata.
- Build instructions for maintainers.
- Operator guide for install/upgrade/uninstall.

Acceptance criteria:

- Fresh macOS machine can install and run PCB via documented steps.
- Existing script-based developer flow continues to work unchanged.

### D2. Native Window Wrapper (Optional, separate decision)

Objective:

- Run the current React UI inside a desktop shell (for example Tauri or Electron).

Notes:

- This is separate from `.pkg` packaging and can be done before or after D1.
- Increases maintenance cost and release complexity.

Deliverables:

- Proof-of-concept desktop wrapper.
- Decision record comparing tradeoffs vs browser-based UI.

## Suggested Execution Order

1. A1, A2
2. B1
3. C1
4. D1 (optional)
5. B2, C2
6. D2 (optional)

## Change Management Rules

- Keep features behind clear scripts and docs.
- Prefer small releases with explicit changelog messages.
- Treat this roadmap as a living document; update priorities after each release.