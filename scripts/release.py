from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION_FILE = ROOT / "VERSION"
CHANGELOG_FILE = ROOT / "CHANGELOG.md"
BACKEND_VERSION_FILE = ROOT / "backend" / "version.py"
FRONTEND_VERSION_FILE = ROOT / "frontend" / "src" / "version.ts"
FRONTEND_PACKAGE_FILE = ROOT / "frontend" / "package.json"
FRONTEND_LOCK_FILE = ROOT / "frontend" / "package-lock.json"

VALID_BUMPS = {"major", "minor", "patch"}


@dataclass(frozen=True)
class ReleaseInput:
    bump_type: str
    message: str


def parse_args(argv: list[str]) -> ReleaseInput:
    if len(argv) < 3:
        raise SystemExit(
            "Usage: python scripts/release.py [major|minor|patch] \"Change summary\""
        )

    bump_type = argv[1].strip().lower()
    if bump_type not in VALID_BUMPS:
        raise SystemExit(f"Invalid bump type: {bump_type}. Use one of: {', '.join(sorted(VALID_BUMPS))}")

    message = " ".join(argv[2:]).strip()
    if not message:
        raise SystemExit("Release message cannot be empty.")

    return ReleaseInput(bump_type=bump_type, message=message)


def read_version() -> str:
    return VERSION_FILE.read_text(encoding="utf-8").strip()


def bump_version(current: str, bump_type: str) -> str:
    major, minor, patch = (int(part) for part in current.split("."))

    if bump_type == "major":
        return f"{major + 1}.0.0"
    if bump_type == "minor":
        return f"{major}.{minor + 1}.0"
    return f"{major}.{minor}.{patch + 1}"


def write_text(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def update_package_json(version: str) -> None:
    package_data = json.loads(FRONTEND_PACKAGE_FILE.read_text(encoding="utf-8"))
    package_data["version"] = version
    FRONTEND_PACKAGE_FILE.write_text(json.dumps(package_data, indent=2) + "\n", encoding="utf-8")


def update_package_lock(version: str) -> None:
    if not FRONTEND_LOCK_FILE.exists():
        return

    lock_data = json.loads(FRONTEND_LOCK_FILE.read_text(encoding="utf-8"))
    lock_data["version"] = version
    packages = lock_data.get("packages")
    if isinstance(packages, dict) and "" in packages and isinstance(packages[""], dict):
        packages[""]["version"] = version
    FRONTEND_LOCK_FILE.write_text(json.dumps(lock_data, indent=2) + "\n", encoding="utf-8")


def update_changelog(version: str, message: str) -> None:
    today = date.today().isoformat()
    existing = CHANGELOG_FILE.read_text(encoding="utf-8")
    unreleased_header = "## [Unreleased]"
    new_entry = f"## [{version}] - {today}\n- {message}\n"

    if unreleased_header not in existing:
        raise SystemExit("CHANGELOG.md is missing the '## [Unreleased]' section.")

    updated = existing.replace(unreleased_header, f"{unreleased_header}\n\n{new_entry}", 1)
    updated = re.sub(r"\n{3,}", "\n\n", updated)
    write_text(CHANGELOG_FILE, updated)


def main(argv: list[str]) -> int:
    release_input = parse_args(argv)
    current_version = read_version()
    new_version = bump_version(current_version, release_input.bump_type)

    write_text(VERSION_FILE, f"{new_version}\n")
    write_text(BACKEND_VERSION_FILE, f'APP_VERSION = "{new_version}"\n')
    write_text(FRONTEND_VERSION_FILE, f"export const APP_VERSION = '{new_version}';\n")
    update_package_json(new_version)
    update_package_lock(new_version)
    update_changelog(new_version, release_input.message)

    print(f"Version bumped: {current_version} -> {new_version}")
    print(f"Changelog updated with: {release_input.message}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
